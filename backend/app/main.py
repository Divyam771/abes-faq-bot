import time

from fastapi import FastAPI, HTTPException

from backend.app.core.config import settings
from backend.app.repositories.vector_repository import VectorRepository
from backend.app.schemas.chat import ChatRequest, ChatResponse
from backend.app.services.embedding_service import EmbeddingService
from backend.app.services.generation_service import (
    BUSY_MESSAGE,
    GenerationService,
)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
)

# Built once when the server starts, not on every request. Reusing them
# avoids ~2 seconds of setup per question and lets the HTTP connections
# to Gemini and Astra DB be reused.
embedding_service = EmbeddingService()
vector_repository = VectorRepository()
generation_service = GenerationService()

# Repeated questions are answered from memory: no embedding, no Astra
# search and no Gemini call. The cache is cleared whenever the backend
# restarts, so restart it after re-seeding the database.
CACHE_TTL_SECONDS = 24 * 60 * 60
CACHE_MAX_ENTRIES = 200
_answer_cache: dict[str, tuple[float, str, list[str]]] = {}


def _cache_key(question: str) -> str:
    return " ".join(question.lower().split()).rstrip("?!. ")


def _ms(start: float) -> float:
    return (time.perf_counter() - start) * 1000


def _describe(exc: Exception) -> str:
    """Short description of a failure, including Astra's reply if present."""
    response = getattr(getattr(exc, "httpx_error", None), "response", None)
    if response is not None:
        return f"HTTP {response.status_code}: {response.text[:300]}"
    return f"{type(exc).__name__}: {str(exc)[:200]}"


@app.get("/")
def root():
    return {"message": "ABES FAQ Chatbot API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/config-status")
def config_status():
    return {
        "gemini_api_key": bool(settings.GEMINI_API_KEY),
        "astra_endpoint": bool(settings.ASTRA_DB_API_ENDPOINT),
        "astra_token": bool(settings.ASTRA_DB_APPLICATION_TOKEN),
        "astra_namespace": bool(settings.ASTRA_DB_NAMESPACE),
        "astra_collection": settings.ASTRA_DB_COLLECTION,
    }


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    started = time.perf_counter()
    key = _cache_key(request.question)

    cached = _answer_cache.get(key)
    if cached and time.time() - cached[0] < CACHE_TTL_SECONDS:
        print(f"[chat] cache hit in {_ms(started):.0f} ms", flush=True)
        return ChatResponse(answer=cached[1], sources=cached[2])

    try:
        step = time.perf_counter()
        query_embedding = embedding_service.embed_text(request.question)
        embed_ms = _ms(step)

        # find() is lazy: the request to Astra only happens when the
        # results are read, so list() is what we time here.
        step = time.perf_counter()
        documents = list(
            vector_repository.search(
                embedding=query_embedding,
                limit=5,
            )
        )
        search_ms = _ms(step)
    except Exception as exc:
        print(f"[chat] retrieval failed: {_describe(exc)}", flush=True)
        raise HTTPException(
            status_code=503,
            detail="I couldn't look that up right now. Please try again in a minute.",
        )

    context_parts = []
    sources = []

    for document in documents:
        source = document.get("source", "Unknown source")
        text = document.get("text", "")

        context_parts.append(
            f"Source: {source}\n{text}"
        )

        if source not in sources:
            sources.append(source)

    context = "\n\n---\n\n".join(context_parts)

    step = time.perf_counter()
    answer = generation_service.generate_answer(
        question=request.question,
        context=context,
    )
    generate_ms = _ms(step)

    if answer != BUSY_MESSAGE:
        if len(_answer_cache) >= CACHE_MAX_ENTRIES:
            _answer_cache.pop(next(iter(_answer_cache)))
        _answer_cache[key] = (time.time(), answer, sources)

    print(
        f"[chat] embed {embed_ms:.0f} ms | search {search_ms:.0f} ms | "
        f"generate {generate_ms:.0f} ms | total {_ms(started):.0f} ms",
        flush=True,
    )

    return ChatResponse(
        answer=answer,
        sources=sources,
    )
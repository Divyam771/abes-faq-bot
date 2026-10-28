from fastapi import FastAPI

from backend.app.core.config import settings
from backend.app.repositories.vector_repository import VectorRepository
from backend.app.schemas.chat import ChatRequest, ChatResponse
from backend.app.services.embedding_service import EmbeddingService
from backend.app.services.generation_service import GenerationService


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
)


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
    embedding_service = EmbeddingService()
    vector_repository = VectorRepository()
    generation_service = GenerationService()

    query_embedding = embedding_service.embed_text(request.question)

    results = vector_repository.search(
        embedding=query_embedding,
        limit=5,
    )

    context_parts = []
    sources = []

    for document in results:
        source = document.get("source", "Unknown source")
        text = document.get("text", "")

        context_parts.append(
            f"Source: {source}\n{text}"
        )

        if source not in sources:
            sources.append(source)

    context = "\n\n---\n\n".join(context_parts)

    answer = generation_service.generate_answer(
        question=request.question,
        context=context,
    )

    return ChatResponse(
        answer=answer,
        sources=sources,
    )
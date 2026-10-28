import time

from backend.app.services.embedding_service import EmbeddingService
from backend.app.services.generation_service import GenerationService
from backend.app.repositories.vector_repository import VectorRepository

QUESTIONS = [
    "What courses does ABES offer?",
    "What is the fee structure?",
]


def ms(start: float) -> float:
    return (time.perf_counter() - start) * 1000


t = time.perf_counter()
embedder = EmbeddingService()
generator = GenerationService()
repo = VectorRepository()
print(f"service init: {ms(t):.0f} ms")

for i, question in enumerate(QUESTIONS, 1):
    print(f"\nQ{i}: {question}")
    total = time.perf_counter()

    t = time.perf_counter()
    vector = embedder.embed_text(question)
    print(f"  embed    {ms(t):7.0f} ms")

    t = time.perf_counter()
    docs = list(repo.search(vector, limit=5))
    context = "\n\n".join(d.get("text", "") for d in docs)
    print(f"  search   {ms(t):7.0f} ms   ({len(docs)} chunks, {len(context)} chars of context)")

    t = time.perf_counter()
    try:
        answer = generator.generate_answer(question, context)
        print(f"  generate {ms(t):7.0f} ms   ({len(answer)} chars in answer)")
    except Exception as exc:
        print(f"  generate FAILED after {ms(t):.0f} ms: {type(exc).__name__}: {str(exc)[:120]}")

    print(f"  total    {ms(total):7.0f} ms")
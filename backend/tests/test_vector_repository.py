from backend.app.repositories.vector_repository import VectorRepository
from backend.app.services.embedding_service import EmbeddingService


embedding_service = EmbeddingService()
vector_repository = VectorRepository()

text = "ABES Engineering College FAQ chatbot test document."

embedding = embedding_service.embed_text(text)

print("Embedding dimensions:", len(embedding))

result = vector_repository.insert_chunk(
    text=text,
    embedding=embedding,
    metadata={
        "source": "test",
        "type": "test_document",
    },
)

print("Inserted document ID:", result.inserted_id)

results = vector_repository.search(
    embedding=embedding,
    limit=3,
)

print("Search results:")

for document in results:
    print(document)

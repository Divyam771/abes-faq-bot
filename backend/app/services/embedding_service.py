from google import genai

from backend.app.core.config import settings


class EmbeddingService:
    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is missing")

        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = "gemini-embedding-001"

    def embed_text(self, text: str) -> list[float]:
        result = self.client.models.embed_content(
            model=self.model,
            contents=text,
        )

        return list(result.embeddings[0].values)

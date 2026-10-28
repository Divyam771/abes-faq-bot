from google import genai

from backend.app.core.config import settings


class GenerationService:
    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is missing")

        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = "gemini-3.5-flash"

    def generate_answer(self, question: str, context: str) -> str:
        prompt = f"""
You are the ABES Engineering College FAQ chatbot.

Answer the user's question using only the information provided
in the context below.

If the answer is not available in the context, say:
"I couldn't find that information in the available ABES College sources."

Do not invent facts.
Keep the answer clear, concise, and helpful.

Context:
{context}

User question:
{question}

Answer:
"""

        interaction = self.client.interactions.create(
            model=self.model,
            input=prompt,
            generation_config={
                "thinking_level": "low"
            },
        )

        return interaction.output_text or ""

import time

from google import genai
from google.genai import types

from backend.app.core.config import settings

# Models are tried in order. If one is slow or fails, the next one is used.
# Each entry is (model name, seconds to wait before giving up on it).
# These are starting values: tune them after you see real timings.
MODELS = [
    ("gemini-3.5-flash-lite", 10),
    ("gemini-3.5-flash", 15),
]

# Keep this generous: reasoning tokens may count toward the limit, and a
# value that is too small can cut answers off or return empty text.
MAX_OUTPUT_TOKENS = 1024

# Repeated questions are answered from memory (no Gemini call, no quota).
CACHE_TTL_SECONDS = 24 * 60 * 60
CACHE_MAX_ENTRIES = 200

BUSY_MESSAGE = (
    "The assistant is very busy right now. Please try again in a minute."
)


def _normalize(question: str) -> str:
    return " ".join(question.lower().split()).rstrip("?!. ")


class GenerationService:
    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is missing")

        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = MODELS[0][0]
        self._cache: dict[str, tuple[float, str]] = {}

    def _remember(self, key: str, answer: str) -> None:
        if len(self._cache) >= CACHE_MAX_ENTRIES:
            self._cache.pop(next(iter(self._cache)))
        self._cache[key] = (time.time(), answer)

    def generate_answer(self, question: str, context: str) -> str:
        key = _normalize(question)
        cached = self._cache.get(key)
        if cached and time.time() - cached[0] < CACHE_TTL_SECONDS:
            print("[generation] cache hit", flush=True)
            return cached[1]

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

        for model, timeout_seconds in MODELS:
            started = time.perf_counter()
            try:
                response = self.client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        max_output_tokens=MAX_OUTPUT_TOKENS,
                        thinking_config=types.ThinkingConfig(
                            thinking_level=types.ThinkingLevel.LOW
                        ),
                        http_options=types.HttpOptions(
                            timeout=int(timeout_seconds * 1000)
                        ),
                    ),
                )
                answer = (response.text or "").strip()
                if not answer:
                    raise RuntimeError("model returned empty text")

                elapsed = time.perf_counter() - started
                print(f"[generation] {model} ok in {elapsed:.1f}s", flush=True)
                self._remember(key, answer)
                return answer
            except Exception as exc:
                elapsed = time.perf_counter() - started
                print(
                    f"[generation] {model} failed after {elapsed:.1f}s: "
                    f"{type(exc).__name__}: {str(exc)[:120]}",
                    flush=True,
                )

        return BUSY_MESSAGE
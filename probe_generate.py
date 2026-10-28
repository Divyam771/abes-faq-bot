import time

from google import genai
from google.genai import types

from backend.app.core.config import settings

client = genai.Client(
    api_key=settings.GEMINI_API_KEY,
    http_options=types.HttpOptions(timeout=20_000),  # milliseconds
)

CANDIDATES = [
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
]

for model_id in CANDIDATES:
    start = time.perf_counter()
    try:
        response = client.models.generate_content(
            model=model_id,
            contents="Reply with the single word: OK",
        )
        ms = (time.perf_counter() - start) * 1000
        text = (response.text or "").strip()[:20]
        print(f"{model_id:26} OK in {ms:6.0f} ms -> {text!r}", flush=True)
    except Exception as exc:
        ms = (time.perf_counter() - start) * 1000
        print(f"{model_id:26} FAILED after {ms:.0f} ms: {type(exc).__name__}: {str(exc)[:100]}", flush=True)
import os
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError

from google import genai

from backend.app.core.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)


def say(msg: str) -> None:
    print(msg, flush=True)


available = sorted(
    m.name.removeprefix("models/")
    for m in client.models.list()
    if "flash" in m.name
)
say("Flash models your key can see:")
say("  " + ", ".join(available))
say("")


def one_call(model_id: str) -> str:
    interaction = client.interactions.create(
        model=model_id,
        input="Reply with the single word: OK",
        generation_config={"thinking_level": "low"},
    )
    return interaction.output_text or ""


CANDIDATES = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
]

pool = ThreadPoolExecutor(max_workers=len(CANDIDATES))
for model_id in CANDIDATES:
    if model_id not in available:
        say(f"{model_id:18} not in this key's model list")
        continue
    start = time.perf_counter()
    future = pool.submit(one_call, model_id)
    try:
        text = future.result(timeout=25)
        elapsed = (time.perf_counter() - start) * 1000
        say(f"{model_id:18} OK in {elapsed:6.0f} ms -> {text.strip()[:20]!r}")
    except TimeoutError:
        say(f"{model_id:18} no reply within 25 s (likely throttled and retrying)")
    except Exception as exc:
        elapsed = (time.perf_counter() - start) * 1000
        say(f"{model_id:18} FAILED after {elapsed:.0f} ms: {type(exc).__name__}")

os._exit(0)
import os

from dotenv import load_dotenv

load_dotenv(".env.local")


class Settings:
    APP_NAME: str = "ABES FAQ Chatbot API"
    APP_VERSION: str = "1.0.0"

    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    ASTRA_DB_API_ENDPOINT: str = os.getenv("ASTRA_DB_API_ENDPOINT", "")
    ASTRA_DB_APPLICATION_TOKEN: str = os.getenv("ASTRA_DB_APPLICATION_TOKEN", "")
    ASTRA_DB_NAMESPACE: str = os.getenv("ASTRA_DB_NAMESPACE", "")
    ASTRA_DB_COLLECTION: str = os.getenv("ASTRA_DB_COLLECTION", "faq_chunks")


settings = Settings()

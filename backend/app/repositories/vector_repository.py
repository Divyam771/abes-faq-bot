from astrapy import DataAPIClient

from backend.app.core.config import settings


class VectorRepository:
    def __init__(self):
        if not settings.ASTRA_DB_API_ENDPOINT:
            raise RuntimeError("ASTRA_DB_API_ENDPOINT is missing")

        if not settings.ASTRA_DB_APPLICATION_TOKEN:
            raise RuntimeError("ASTRA_DB_APPLICATION_TOKEN is missing")

        client = DataAPIClient()

        database = client.get_database(
            settings.ASTRA_DB_API_ENDPOINT,
            token=settings.ASTRA_DB_APPLICATION_TOKEN,
        )

        self.collection = database.get_collection(
            settings.ASTRA_DB_COLLECTION
        )

    def search(
        self,
        embedding: list[float],
        limit: int = 5,
    ):
        return self.collection.find(
            sort={"$vector": embedding},
            limit=limit,
        )

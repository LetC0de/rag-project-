from qdrant_client import QdrantClient
from src.utils.settings import settings

client = QdrantClient(
    url=settings.QDRANT_URL,
    api_key=settings.QDRANT_API_KEY
)

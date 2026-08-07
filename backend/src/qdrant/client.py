from qdrant_client import QdrantClient
from src.utils.settings import settings

# Cloud Qdrant can take a while to answer a vector search, especially the
# first one (cold collection, warm-up) or a slow network hop. The default
# httpx read timeout is only a few seconds, which made /chat/query 500 with
# "read operation timed out" intermittently. Give it a generous budget.
client = QdrantClient(
    url=settings.QDRANT_URL,
    api_key=settings.QDRANT_API_KEY,
    timeout=120.0,
)

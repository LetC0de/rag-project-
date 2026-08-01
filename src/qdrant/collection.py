from qdrant_client.models import Distance, VectorParams
from .client import client


COLLECTION_NAME = "documents"


def create_collection():

    collections = client.get_collections().collections

    names = [c.name for c in collections]

    if COLLECTION_NAME not in names:

        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=1024,
                distance=Distance.COSINE
            )
        )
from qdrant_client.models import Distance, VectorParams
from .client import client

COLLECTION_NAME = "documents"


def create_collection():

    if client.collection_exists(COLLECTION_NAME):
        print("Collection already exists.")
        return

    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(
            size=1024,
            distance=Distance.COSINE
        )
    )

    print("Collection created successfully.")

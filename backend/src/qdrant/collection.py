from qdrant_client.models import Distance, VectorParams, PayloadSchemaType
from .client import client

COLLECTION_NAME = "documents"


def create_payload_index():
    """Create payload index for filtering on metadata.document_id."""
    client.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="metadata.document_id",
        field_schema=PayloadSchemaType.INTEGER,
    )


def create_collection():

    if not client.collection_exists(COLLECTION_NAME):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=1024,
                distance=Distance.COSINE
            )
        )
        print("Collection created successfully.")
    else:
        print("Collection already exists.")

    # Payload index required for filtering on metadata.document_id.
    # create_payload_index is idempotent — safe to call on existing collections.
    create_payload_index()
    print("Payload index ensured.")

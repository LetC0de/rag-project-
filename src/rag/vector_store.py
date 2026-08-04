from langchain_qdrant import QdrantVectorStore

from src.qdrant.client import client
from src.qdrant.collection import COLLECTION_NAME, create_collection
from src.rag.embeddings import embeddings

# Ensure collection exists before creating the vector store.
# If the collection was deleted (e.g. manually), create it again —
# otherwise QdrantVectorStore validation fails with 404.
create_collection()

vector_store = QdrantVectorStore(
    client=client,
    collection_name=COLLECTION_NAME,
    embedding=embeddings
)

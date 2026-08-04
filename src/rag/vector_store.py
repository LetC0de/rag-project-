from langchain_qdrant import QdrantVectorStore

from src.qdrant.client import client
from src.qdrant.collection import COLLECTION_NAME
from src.rag.embeddings import embeddings

vector_store = QdrantVectorStore(
    client=client,
    collection_name=COLLECTION_NAME,
    embedding=embeddings
)

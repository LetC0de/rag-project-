from qdrant_client.http.models import Filter, FieldCondition, MatchValue

from src.rag.vector_store import vector_store


def detect_query_type(question):
    """Detect if query is asking for summary/overview or specific facts"""

    question_lower = question.lower().strip()

    summary_keywords = [
        "summary", "summarize", "summarise",
        "about this document", "about the document", "about this pdf",
        "overview", "main points", "key points",
        "what is this", "tell me about", "explain this",
        "describe", "introduction", "content of",
        "what does this document", "document about"
    ]

    return any(keyword in question_lower for keyword in summary_keywords)


def get_retriever(question: str, document_id: int):

    qdrant_filter = Filter(
        must=[
            FieldCondition(
                key="metadata.document_id",
                match=MatchValue(value=document_id)
            )
        ]
    )

    if detect_query_type(question):

        return vector_store.as_retriever(
            search_type="similarity",
            search_kwargs={
                "k": 6,
                "filter": qdrant_filter
            }
        )

    return vector_store.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": 4,
            "fetch_k": 10,
            "lambda_mult": 0.5,
            "filter": qdrant_filter
        }
    )

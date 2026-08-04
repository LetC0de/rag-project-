from qdrant_client.models import FieldCondition, Filter, MatchValue

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


def get_retriever(question, document_id=None):
    """Get appropriate retriever based on query type, filtered to a document"""
    qdrant_filter = None
    if document_id is not None:
        qdrant_filter = Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=document_id)
                )
            ]
        )

    is_summary_query = detect_query_type(question)

    if is_summary_query:
        return vector_store.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 6, "filter": qdrant_filter}
        )
    else:
        return vector_store.as_retriever(
            search_type="mmr",
            search_kwargs={
                "k": 4,
                "fetch_k": 10,
                "lambda_mult": 0.5,
                "filter": qdrant_filter
            }
        )

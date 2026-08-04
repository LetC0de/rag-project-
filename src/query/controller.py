from fastapi import HTTPException
from src.document.model import DocumentModel
from src.query.schema import QueryRequestSchema
from src.rag.retriever import get_retriever
from sqlalchemy.orm import Session


async def ask_question(request: QueryRequestSchema, db: Session):

    # Check document exists in PostgreSQL before querying Qdrant
    document = (
        db.query(DocumentModel)
        .filter(DocumentModel.id == request.document_id)
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    # Step 4 - Create Retriever & Retrieve Chunks
    # Filter by document_id so Qdrant only searches this document's chunks
    retriever = get_retriever(
        request.question,
        request.document_id
    )

    docs = retriever.invoke(request.question)

    context = "\n\n".join(
        [doc.page_content for doc in docs]
    )

    return {
        "message": "Document found",
        "document_id": document.id,
        "question": request.question,
        "context": context
    }
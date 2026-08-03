from fastapi import HTTPException
from src.document.model import DocumentModel
from src.query.schema import QueryRequestSchema
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

    return {
        "message": "Document found",
        "document_id": document.id,
        "question": request.question
    }
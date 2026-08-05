from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.document.model import DocumentModel
from src.document.schema import OutSchema
from src.user.model import UserModel
from src.utils.db import get_db
from src.utils.helpers import is_authenticated

document_router = APIRouter(prefix="/documents", tags=["Documents"])


@document_router.get("/", response_model=list[OutSchema])
async def list_documents(
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    """List the current user's documents, newest first."""
    return (
        db.query(DocumentModel)
        .filter(DocumentModel.user_id == user.id)
        .order_by(DocumentModel.created_at.desc())
        .all()
    )


@document_router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    """Delete a document record (and its chunks in Qdrant)."""
    document = (
        db.query(DocumentModel)
        .filter(
            DocumentModel.id == document_id,
            DocumentModel.user_id == user.id,
        )
        .first()
    )

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove this document's chunks from Qdrant so they stop matching searches.
    from src.rag.vector_store import vector_store

    try:
        vector_store.client.delete(
            collection_name=vector_store.collection_name,
            points_selector={"filter": {"must": [
                {"key": "document_id", "match": {"value": document_id}}
            ]}},
        )
    except Exception:
        # If Qdrant cleanup fails, still remove the record so the UI isn't stuck.
        pass

    db.delete(document)
    db.commit()

    return {"ok": True, "deleted_id": document_id}

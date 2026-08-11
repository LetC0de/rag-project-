from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.document.model import DocumentModel
from src.query.schema import QueryRequestSchema
from src.query.controller import stream_question
from src.user.model import UserModel
from src.utils.db import get_db
from src.utils.helpers import is_authenticated

chat_router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)

@chat_router.post("/query")
async def query(
    request: QueryRequestSchema,
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db)
):
    # Validate the document BEFORE the Stream opened — raising inside the
    # generator would return an empty 200 (streaming has already sent headers).
    if request.document_id is not None:
        document = (
            db.query(DocumentModel)
            .filter(
                DocumentModel.id == request.document_id,
                DocumentModel.user_id == user.id,
            )
            .first()
        )

        if not document:
            raise HTTPException(
                status_code=404,
                detail="Document not found"
            )
        if document.status != "processed":
            raise HTTPException(
                status_code=409,
                detail="Document is not ready"
            )

    # Streaming Server-Sent Events response. The generator runs inside the
    # StreamingResponse body — FastAPI handles encoding each yielded frame.
    return StreamingResponse(
        stream_question(request, db, user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
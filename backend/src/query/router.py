from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.conversation.controller import touch
from src.conversation.model import ConversationModel
from src.document.model import DocumentModel
from src.graph.streaming import stream_question
from src.query.schema import QueryRequestSchema
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
    db: Session = Depends(get_db),
):
    """SSE endpoint. Validates conversation + document ownership BEFORE the
    stream opens so HTTPException produces a real JSON error instead of an
    empty 200 (stream headers would already be sent).

    Two layers of ownership:
      - conversation: must belong to this user (otherwise user A could reach
        into user B's chat memory).
      - document: must belong to this user AND be 'processed'.

    Both checks raise 404 (conversation) or 404/409 (document), matching the
    existing convention of not leaking existence.
    """
    # Conversation ownership — 404 for "doesn't exist OR not yours"
    conversation = (
        db.query(ConversationModel)
        .filter(
            ConversationModel.id == request.conversation_id,
            ConversationModel.user_id == user.id,
        )
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Document ownership + readiness (only when a document was attached)
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
            raise HTTPException(status_code=404, detail="Document not found")
        if document.status != "processed":
            raise HTTPException(status_code=409, detail="Document is not ready")

    # Bump the conversation's updated_at so the sidebar sorts correctly.
    # Uses onupdate default; we just commit to flush.
    touch(request.conversation_id, user, db)

    return StreamingResponse(
        stream_question(request, user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.conversation.model import ConversationModel
from src.user.model import UserModel


def create_conversation(user: UserModel, db: Session, title: str | None) -> ConversationModel:
    conversation = ConversationModel(
        user_id=user.id,
        title=title or "New Chat",
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def list_conversations(user: UserModel, db: Session) -> list[ConversationModel]:
    return (
        db.query(ConversationModel)
        .filter(ConversationModel.user_id == user.id)
        .order_by(ConversationModel.updated_at.desc())
        .all()
    )


def get_owned_conversation(conversation_id: int, user: UserModel, db: Session) -> ConversationModel:
    """Fetch a conversation AND verify it belongs to the authenticated user.

    Never trust a client-provided conversation_id without this check —
    otherwise user A could reach into user B's chat session. Returns the same
    404 for both "doesn't exist" and "exists but not yours" so we don't leak
    existence (matches the documents router convention).
    """
    conversation = (
        db.query(ConversationModel)
        .filter(
            ConversationModel.id == conversation_id,
            ConversationModel.user_id == user.id,
        )
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def delete_conversation(conversation_id: int, user: UserModel, db: Session) -> None:
    conversation = get_owned_conversation(conversation_id, user, db)
    db.delete(conversation)
    db.commit()


def touch(conversation_id: int, user: UserModel, db: Session) -> None:
    """Bump updated_at on a new message, cheaply. Owned conversations only."""
    conversation = get_owned_conversation(conversation_id, user, db)
    # onupdate handles the timestamp; just commit to persist it.
    db.commit()

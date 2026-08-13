from fastapi import HTTPException
from sqlalchemy.orm import Session

from langchain_core.messages import AIMessage, HumanMessage

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


def rename_conversation(conversation_id: int, title: str, user: UserModel, db: Session) -> ConversationModel:
    """Apply a user-supplied title (manual rename over a generated one)."""
    conversation = get_owned_conversation(conversation_id, user, db)
    conversation.title = title.strip()
    db.commit()
    db.refresh(conversation)
    return conversation


async def get_conversation_messages(
    conversation_id: int, user: UserModel, db: Session
) -> list[dict]:
    """Return a conversation's message history as a plain list for the UI.

    This is the clean application API (Option A) the frontend depends on —
    it does NOT expose LangGraph's internal checkpoint table shape. History
    actually lives in PostgresSaver under thread_id = user-{id}-conversation-{id}
    (see checkpointer.make_thread_id); we read it through the compiled graph's
    aget_state rather than touching checkpoint blobs directly.

    Ownership is enforced via get_owned_conversation, so a 404 is returned for
    both missing and not-yours threads (no existence leak). The LangGraph state
    read is best-effort: if the checkpointer isn't ready we return an empty list
    rather than failing the request — the row still exists, just no messages yet.
    """
    # Validate ownership first; raises 404 otherwise.
    get_owned_conversation(conversation_id, user, db)

    from src.graph.checkpointer import make_thread_id
    from src.graph.graph import get_compiled_graph

    thread_id = make_thread_id(user.id, conversation_id)
    config = {"configurable": {"thread_id": thread_id}}
    try:
        compiled = get_compiled_graph()
        state = await compiled.aget_state(config)
    except Exception:  # noqa: BLE001 - best-effort history read
        # Checkpointer not initialised or state read failed — don't break the UI.
        return []

    messages = (state.values or {}).get("messages", []) if state else []
    out: list[dict] = []
    for m in messages:
        role = None
        content = ""
        if isinstance(m, HumanMessage):
            role = "user"
            content = m.content if isinstance(m.content, str) else str(m.content)
        elif isinstance(m, AIMessage):
            role = "assistant"
            content = m.content if isinstance(m.content, str) else str(m.content)
        else:
            # Skip system / tool / unknown message types in the UI timeline.
            continue
        out.append({"role": role, "content": content})
    return out

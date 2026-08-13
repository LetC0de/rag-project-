from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.conversation.controller import (
    create_conversation,
    delete_conversation as delete_conversation_ctrl,
    get_conversation_messages,
    get_owned_conversation,
    list_conversations,
)
from src.conversation.model import ConversationModel
from src.conversation.schema import (
    ConversationCreateSchema,
    ConversationListSchema,
    ConversationMessagesSchema,
    ConversationOutSchema,
)
from src.user.model import UserModel
from src.utils.db import get_db
from src.utils.helpers import is_authenticated


conversation_router = APIRouter(prefix="/conversations", tags=["Conversations"])


@conversation_router.post("/", response_model=ConversationOutSchema, status_code=201)
async def create_new_conversation(
    body: ConversationCreateSchema | None = None,
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    """Create a new conversation for the authenticated user.

    The frontend calls this on "New Chat". Returns conversation_id, which is
    then sent with every /chat/query request so the LangGraph thread_id is
    deterministic.
    """
    title = (body.title if body else None) or "New Chat"
    conversation = create_conversation(user, db, title)
    return conversation


@conversation_router.get("/", response_model=ConversationListSchema)
async def list_user_conversations(
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    """List the authenticated user's conversations, newest first."""
    items = list_conversations(user, db)
    return {"conversations": items}


@conversation_router.get("/{conversation_id}", response_model=ConversationOutSchema)
async def get_conversation(
    conversation_id: int,
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    """Fetch a single conversation — used by the frontend when switching
    conversations or restoring one after a page reload. Validates ownership."""
    return get_owned_conversation(conversation_id, user, db)


@conversation_router.get(
    "/{conversation_id}/messages",
    response_model=ConversationMessagesSchema,
)
async def get_conversation_message_history(
    conversation_id: int,
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    """Return a conversation's message history for the UI (Option A).

    Reads from the LangGraph PostgresSaver checkpoint under the conversation's
    thread_id and normalises it into a clean `{conversation_id, messages}` shape.
    Ownership is enforced inside the controller; a missing or not-yours
    conversation yields 404 with no existence leak."""
    raw = await get_conversation_messages(conversation_id, user, db)
    return ConversationMessagesSchema(
        id=conversation_id,
        messages=[
            {"role": m["role"], "content": m["content"]} for m in raw
        ],
    )


@conversation_router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    """Delete a conversation and its LangGraph checkpoint thread.

    Application-level deletion removes the row in the conversations table.
    PostgresSaver checkpoints under the same thread_id are removed so memory
    no longer resurrects the deleted chat.
    """
    delete_conversation_ctrl(conversation_id, user, db)

    # Best-effort wipe of the LangGraph checkpoint thread for this conversation.
    # Done here (and not in the checkpointer) because we want both the
    # application row and the persisted message state to disappear together,
    # and the graph may not be initialised yet during a request lifecycle.
    try:
        from src.graph.checkpointer import delete_thread
        from src.user.model import UserModel as _U
        delete_thread(user.id, conversation_id)
    except Exception:
        # Don't fail the user-facing request if checkpoint cleanup fails;
        # the row is already gone and orphaned checkpoints are harmless.
        pass

    return {"ok": True, "deleted_id": conversation_id}
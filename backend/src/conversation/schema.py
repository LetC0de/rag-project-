from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ConversationCreateSchema(BaseModel):
    """Body for POST /conversations."""

    title: Optional[str] = Field(default="New Chat", max_length=200)


class ConversationRenameSchema(BaseModel):
    """Body for PATCH /conversations/{id} — manual rename of a generated title."""

    title: str = Field(..., min_length=1, max_length=200)


class ConversationOutSchema(BaseModel):
    """Conversation returned to the client.

    The DB column is `id`, but the client contract (and the rest of the app)
    uses `conversation_id`. We read the value from `id` via `validation_alias`
    so it can be populated from the ORM row, while `conversation_id` remains the
    *serialisation* key (no `alias` on the output field) — so FastAPI emits
    `{"conversation_id": 101, ...}` rather than `{"id": 101, ...}`.
    """

    model_config = ConfigDict(from_attributes=True)

    conversation_id: int = Field(validation_alias="id")
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationListSchema(BaseModel):
    conversations: list[ConversationOutSchema]


class ConversationMessageSchema(BaseModel):
    """A single turn in a conversation's UI timeline.

    Derived from the LangGraph checkpoint state, normalised down to the two
    fields the frontend actually renders. The backend owns the translation so
    the client never couples to LangGraph's checkpoint internals.
    """

    role: str  # "user" | "assistant"
    content: str


class ConversationMessagesSchema(BaseModel):
    """Response for GET /conversations/{id}/messages (Option A history API)."""

    conversation_id: int = Field(validation_alias="id")
    messages: list[ConversationMessageSchema]

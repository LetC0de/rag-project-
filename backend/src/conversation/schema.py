from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ConversationCreateSchema(BaseModel):
    """Body for POST /conversations."""

    title: Optional[str] = Field(default="New Chat", max_length=200)


class ConversationOutSchema(BaseModel):
    """Conversation returned to the client."""

    model_config = ConfigDict(from_attributes=True)

    conversation_id: int = Field(alias="id")
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationListSchema(BaseModel):
    conversations: list[ConversationOutSchema]

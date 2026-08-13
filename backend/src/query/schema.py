from typing import Optional

from pydantic import BaseModel, Field


class QueryRequestSchema(BaseModel):
    """Payload for POST /chat/query.

    - conversation_id: identifies the chat session (memory thread). Required.
      The backend validates ownership in the conversations table.
    - document_id: identifies which PDF is being asked about. Optional —
      when absent, the assistant answers in concierge mode (about the product)
      instead of retrieving from a document.
    - question: the user's prompt.

    conversation_id and document_id are intentionally separate concepts: a
    single conversation may switch documents over time, and the conversation's
    memory persists across document changes.
    """

    conversation_id: int = Field(..., description="Chat session id; ownership is enforced server-side.")
    document_id: Optional[int] = Field(
        default=None,
        description="PDF id to retrieve from. None = concierge (product-only) answers.",
    )
    question: str
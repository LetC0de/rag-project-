from typing import Optional

from pydantic import BaseModel


class QueryRequestSchema(BaseModel):
    # Optional: when absent, the assistant answers in concierge mode
    # (about the product) instead of retrieving from a document.
    document_id: Optional[int] = None
    question: str

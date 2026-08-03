from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentBase(BaseModel):
    filename: str
    user_id: int
    status: str = "pending"


class DocumentCreate(DocumentBase):
    pass


class DocumentOut(DocumentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
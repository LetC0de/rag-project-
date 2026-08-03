from datetime import datetime
from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
    filename: str
    user_id: int
    status: str = "pending"


class CreateSchema(BaseSchema):
    pass


class OutSchema(BaseSchema):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
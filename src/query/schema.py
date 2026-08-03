from pydantic import BaseModel


class QueryRequestSchema(BaseModel):
    document_id: int
    question: str

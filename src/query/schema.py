from pydantic import BaseModel


class QueryRequest(BaseModel):
    document_id: int
    question: str

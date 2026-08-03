from fastapi import APIRouter
from src.query.schema import QueryRequest
from src.query.controller import ask_question

chat_router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)


@chat_router.post("/query")
async def query(request: QueryRequest):
    return await ask_question(request)

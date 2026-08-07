from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.query.schema import QueryRequestSchema
from src.query.controller import ask_question
from src.user.model import UserModel
from src.utils.db import get_db
from src.utils.helpers import is_authenticated

chat_router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)

@chat_router.post("/query")
async def query(
    request: QueryRequestSchema,
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db)
):
    return await ask_question(request, db, user)
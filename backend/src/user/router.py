from fastapi import APIRouter, Depends, status, Request, BackgroundTasks
from sqlalchemy.orm import Session
from src.user.schema import UserSchema, UserResponseSchema, UserLoginSchema
from src.user import controller
from src.utils.db import get_db

user_router = APIRouter(prefix="/user", tags=["User"])


@user_router.post("/register", response_model=UserResponseSchema, status_code=status.HTTP_201_CREATED)
async def register_user(body: UserSchema, bg_task: BackgroundTasks, db: Session = Depends(get_db)):
    return await controller.register_user(body, db, bg_task)


@user_router.post("/login", status_code=status.HTTP_200_OK)
def login_user(body: UserLoginSchema, db: Session = Depends(get_db)):
    return controller.login_user(body, db)


@user_router.get("/is_auth", response_model=UserResponseSchema, status_code=status.HTTP_200_OK)
def is_authenticated(request: Request, db: Session = Depends(get_db)):
    return controller.is_authenticated(request, db)

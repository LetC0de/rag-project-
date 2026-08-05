from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session

from src.upload.controller import upload_doc
from src.user.model import UserModel
from src.utils.db import get_db
from src.utils.helpers import is_authenticated

upload_router = APIRouter(prefix="/upload", tags=["Upload"])


@upload_router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    user: UserModel = Depends(is_authenticated),
    db: Session = Depends(get_db),
):
    return await upload_doc(file, db, user)

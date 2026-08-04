from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session

from src.upload.controller import upload_doc
from src.utils.db import get_db

upload_router = APIRouter(prefix="/upload")



@upload_router.post("/upload")
async def upload(file: UploadFile = File(...),db: Session = Depends(get_db)):
    return await upload_doc(file, db)

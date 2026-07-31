from fastapi import APIRouter, UploadFile, File
from src.upload.controller import upload_doc

upload_router = APIRouter(prefix="/upload")



@upload_router.post("/upload")
async def upload(file: UploadFile = File(...)):
    return await upload_doc(file)

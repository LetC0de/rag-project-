from fastapi import UploadFile

async def upload_doc(file: UploadFile):
    return {  "file name": file.filename,
                    "content type": file.content_type,
                    "message": "File uploaded successfully"}
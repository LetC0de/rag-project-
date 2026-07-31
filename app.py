from fastapi import FastAPI
from src.upload.router import upload_router

app = FastAPI(title = "Enterprise Knowledge Asistant")


app.include_router(upload_router)
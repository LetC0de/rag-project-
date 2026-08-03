from contextlib import asynccontextmanager
from fastapi import FastAPI
from src.qdrant.collection import create_collection
from src.upload.router import upload_router
from src.utils.db import base,engine
from src.document.model import Document



base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_collection()
    yield


app = FastAPI(title="Enterprise Knowledge Asistant", lifespan=lifespan)


app.include_router(upload_router)

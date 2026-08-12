from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.qdrant.collection import create_collection
from src.document.router import document_router
from src.query.router import chat_router
from src.upload.router import upload_router
from src.user.router import user_router
from src.utils.db import base,engine
from src.utils.settings import settings



base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_collection()
    yield


app = FastAPI(title="Enterprise Knowledge Asistant", lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(chat_router)
app.include_router(document_router)
app.include_router(user_router)


@app.get("/")
async def root():
    return {"message": "Enterprise Knowledge Assistant API"}

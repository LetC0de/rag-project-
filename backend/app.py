from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.qdrant.collection import create_collection
from src.document.router import document_router
from src.query.router import chat_router
from src.upload.router import upload_router
from src.utils.db import base,engine



base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_collection()
    yield


app = FastAPI(title="Enterprise Knowledge Asistant", lifespan=lifespan)

# Allow the Vite dev server (and any local frontend) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(chat_router)
app.include_router(document_router)


@app.get("/")
async def root():
    return {"message": "Enterprise Knowledge Assistant API"}

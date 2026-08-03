from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_mistralai import MistralAIEmbeddings
from sqlalchemy.orm import Session
import tempfile

from src.document.model import Document
from src.utils.settings import settings


async def upload_doc(file: UploadFile, db: Session):

    # ==========================
    # Step 1 - Save Metadata First
    # ==========================

    document = Document(
        filename=file.filename,
        status="processing"
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    document_id = document.id

    # Create temporary PDF file
    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=".pdf"
    ) as temp_file:

        # Read uploaded PDF
        contents = await file.read()

        # Write uploaded bytes
        temp_file.write(contents)

        # Temporary file path
        temp_file_path = temp_file.name

    # ==========================
    # Extract Text
    # ==========================

    loader = PyPDFLoader(temp_file_path)
    docs = loader.load()

    # ==========================
    # Split Documents
    # ==========================

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )

    chunks = splitter.split_documents(docs)

    # ==========================
    # Step 2 - Add Metadata in Every Chunk
    # ==========================

    for chunk in chunks:
        chunk.metadata["document_id"] = document.id
        chunk.metadata["filename"] = file.filename

    # ==========================
    # Step 3 - Embedding
    # ==========================

    embeddings = MistralAIEmbeddings(
        model=settings.MISTRAL_MODEL,
    )

    return {
        "message": "Document split successfully",
        "document_id": document_id,
        "original_filename": file.filename,
        "pages": len(docs),
        "chunks": len(chunks),
        "temp_file_path": temp_file_path
    }

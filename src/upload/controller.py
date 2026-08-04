from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session
import os
import tempfile

from src.document.model import DocumentModel
from src.rag.vector_store import vector_store


async def upload_doc(file: UploadFile, db: Session):

    # ==========================
    # Step 1 - Save Metadata First
    # ==========================

    document = DocumentModel(
        filename=file.filename,
        status="processing"
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    document_id = document.id

    temp_file_path = None

    try:

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
        # Step 4 - Upload to Qdrant
        # ==========================
        # vector_store: singleton from src/rag/vector_store.py
        # embeddings: singleton from src/rag/embeddings.py

        vector_store.add_documents(chunks)

        # ==========================
        # Step 5 - Update Status (success)
        # ==========================

        document.status = "processed"
        db.commit()

    except Exception:

        # ==========================
        # Step 5 - Update Status (failure)
        # ==========================

        document.status = "failed"
        db.commit()

        raise

    finally:

        # ==========================
        # Step 6 - Delete Temporary File
        # ==========================

        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)

    # ==========================
    # Step 7 - Response
    # ==========================

    return {
        "document_id": document.id,
        "status": "processed"
    }

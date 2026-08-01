from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import tempfile


async def upload_doc(file: UploadFile):

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

    return {
        "message": "Document split successfully",
        "original_filename": file.filename,
        "pages": len(docs),
        "chunks": len(chunks),
        "temp_file_path": temp_file_path
    }

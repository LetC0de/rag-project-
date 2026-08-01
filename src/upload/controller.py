from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader
import tempfile


async def upload_doc(file: UploadFile):

    # Create temporary PDF file
    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=".pdf"
    ) as temp_file:

        # Read uploaded PDF
        contents = await file.read()

        # Write uploaded bytes to temp file
        temp_file.write(contents)

        # Get temporary file path
        temp_file_path = temp_file.name

    # ==============================
    # Extract text (Your original code)
    # ==============================

    loader = PyPDFLoader(temp_file_path)
    docs = loader.load()

    return {
        "message": "Text extracted successfully",
        "original_filename": file.filename,
        "pages": len(docs),
        "temp_file_path": temp_file_path
    }

from fastapi import UploadFile
import tempfile


async def upload_doc(file: UploadFile):

    # Create a temporary PDF file
    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=".pdf"
    ) as temp_file:

        # Read uploaded PDF
        contents = await file.read()

        # Write into temporary file
        temp_file.write(contents)

        # Get temporary file path
        temp_file_path = temp_file.name

    return {
        "message": "Temporary file created successfully",
        "original_filename": file.filename,
        "temp_file_path": temp_file_path
    }

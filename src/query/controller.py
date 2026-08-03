from src.query.schema import QueryRequest


async def ask_question(request: QueryRequest):

    return {
        "document_id": request.document_id,
        "question": request.question
    }

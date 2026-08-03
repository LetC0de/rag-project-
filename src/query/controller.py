from src.query.schema import QueryRequestSchema


async def ask_question(request: QueryRequestSchema):

    return {
        "document_id": request.document_id,
        "question": request.question
    }

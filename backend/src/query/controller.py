from fastapi import HTTPException
from src.document.model import DocumentModel
from src.query.schema import QueryRequestSchema
from src.rag.llm import llm
from src.rag.prompt import prompt
from src.rag.retriever import get_retriever
from src.user.model import UserModel
from sqlalchemy.orm import Session


async def ask_question(request: QueryRequestSchema, db: Session, user: UserModel):

    # Check document exists (and belongs to the user) before querying Qdrant
    document = (
        db.query(DocumentModel)
        .filter(
            DocumentModel.id == request.document_id,
            DocumentModel.user_id == user.id,
        )
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    # Step 4 - Create Retriever & Retrieve Chunks
    # Filter by document_id so Qdrant only searches this document's chunks
    retriever = get_retriever(
        request.question,
        request.document_id
    )

    docs = retriever.invoke(request.question)

    # Step 1 - Empty Result Check
    if not docs:
        return {
            "answer": "I could not find enough information in the document to answer this question."
        }

    # Step 2 - Build Context
    context = "\n\n".join(
        [doc.page_content for doc in docs]
    )

    # Step 3 - Prompt
    final_prompt = prompt.invoke(
        {
            "context": context,
            "question": request.question
        }
    )

    # Step 4 - LLM
    response = llm.invoke(final_prompt)

    # Step 4.5 - Collect source citations from the retrieved chunks.
    # Dedup by (filename, page) — a single page can contribute multiple chunks.
    # Only page + filename are exposed; the temp server file path in
    # metadata["source"] is intentionally omitted.
    sources = []
    seen = set()
    for doc in docs:
        meta = doc.metadata
        key = (meta.get("filename"), meta.get("page"))
        if key in seen or key == (None, None):
            continue
        seen.add(key)
        sources.append(
            {"page": meta.get("page"), "filename": meta.get("filename")}
        )

    # Step 5 - Return
    return {
        "document_id": request.document_id,
        "question": request.question,
        "answer": response.content,
        "sources": sources
    }
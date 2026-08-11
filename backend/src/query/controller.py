import asyncio
import json
import traceback

from fastapi import HTTPException
from src.document.model import DocumentModel
from src.query.schema import QueryRequestSchema
from src.rag.llm import llm
from src.rag.prompt import concierge_prompt, prompt
from src.rag.retriever import get_retriever
from src.user.model import UserModel
from sqlalchemy.orm import Session


def _sse(event: str, payload: dict) -> str:
    """Format a Server-Sent Events frame: event name + one JSON data line."""
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _collect_sources(docs):
    """Collect source citations from the retrieved chunks, deduped by (filename, page).

    A single page can contribute multiple chunks, so only the first chunk per
    (filename, page) is kept. Only page + filename are exposed; the temp server
    file path in metadata["source"] is intentionally omitted.
    """
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
    return sources


def _retrieve(request: QueryRequestSchema):
    """Create the retriever for the question and run it against Qdrant.

    Synchronous Qdrant calls live here so the async generator can offload them
    to a worker thread via asyncio.to_thread — keeping the event loop free.
    """
    retriever = get_retriever(request.question, request.document_id)
    return retriever.invoke(request.question)


async def stream_question(request: QueryRequestSchema, db: Session, user: UserModel):
    """SSE generator that yields retrieval sources, then the answer token-by-token.

    Event order: sources first (renders citation chips), then one `token` event
    per LLM chunk, then a final `done` event. On a mid-stream failure an `error`
    event is sent and the stream is closed.
    """
    try:
        # Concierge mode: no document selected. Answer about the product itself
        # from the curated concierge prompt — no retrieval, no citations.
        if request.document_id is None:
            yield _sse("sources", {"sources": [], "document_id": None})

            final_prompt = concierge_prompt.invoke({"question": request.question})
            async for chunk in llm.astream(final_prompt):
                if chunk.content:
                    yield _sse("token", {"delta": chunk.content})

            yield _sse("done", {"document_id": None})
            return

        # Step 1 - Retrieve Chunks
        # Runs in a worker thread; the retriever is synchronous, so this avoids
        # blocking the event loop.
        docs = await asyncio.to_thread(_retrieve, request)

        # Step 2 - Sources (before the answer so chips render first)
        sources = _collect_sources(docs)
        yield _sse("sources", {"sources": sources, "document_id": request.document_id})

        # Step 3 - Empty Result Check
        if not docs:
            yield _sse("token", {"delta": "I could not find enough information in the document to answer this question."})
            yield _sse("done", {"document_id": request.document_id})
            return

        # Step 4 - Build Context
        # Tag each chunk with its source page so the model can cite it inline.
        context = "\n\n".join(
            f"[Page {doc.metadata.get('page', '?')}] {doc.page_content}"
            for doc in docs
        )

        # Step 5 - Prompt
        final_prompt = prompt.invoke(
            {
                "context": context,
                "question": request.question
            }
        )

        # Step 6 - Stream the LLM answer token-by-token.
        # ChatMistralAI.astream is fully async (httpx.AsyncClient), so it does
        # not block the event loop.
        async for chunk in llm.astream(final_prompt):
            if chunk.content:
                yield _sse("token", {"delta": chunk.content})

        yield _sse("done", {"document_id": request.document_id})

    except HTTPException:
        # Raised before streaming starts — FastAPI turns this into a JSON error
        # response instead of the SSE stream.
        raise
    except Exception:
        # A mid-stream LLM failure. Emit an error event followed by a final done
        # so the client shows partial text + an error instead of hanging forever.
        print(traceback.format_exc())
        yield _sse("error", {"message": "The model failed while generating a response. Please try again."})
        try:
            yield _sse("done", {"document_id": request.document_id})
        except (GeneratorExit, RuntimeError):
            pass
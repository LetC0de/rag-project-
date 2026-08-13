"""SSE orchestrator for the LangGraph-backed chat endpoint.

Flow per request:
    1. (router) validate conversation + document ownership.
    2. RAG mode: retrieve chunks from Qdrant (filtered by document_id) inside
       a worker thread so we don't block the event loop; build the context
       string; emit `event: sources`.
    3. Stream tokens from Mistral via `llm.astream` -> `event: token` ...
    4. Emit `event: done`.
    5. Persist the exchange (task) with `graph.update_state()` under the
       thread_id, so PostgresSaver checkpoints the message pair for the next
       turn. This is the short-term memory write.

Why `update_state` instead of running `graph.ainvoke`?
    ainvoke would re-run `generate_answer`, calling Mistral a second time and
    producing a *different* answer (LLMs are non-deterministic), then append a
    second AIMessage on top of the already-checkpointed one. That's the
    "answer sent twice / wrong memory" failure mode. `update_state` writes
    exactly the value we give it, marked as if `generate_answer` produced it,
    with no additional model or retrieval calls. The real token stream to the
    client uses the same `llm.astream` the original SSE code used.

Single Mistral call per request; single Qdrant retrieval; single checkpoint.
"""
from __future__ import annotations

import asyncio
import json
import traceback
from typing import Any, AsyncIterator, Optional

from langchain_core.messages import AIMessage, HumanMessage

from src.graph.checkpointer import make_thread_id
from src.graph.graph import get_compiled_graph
from src.query.schema import QueryRequestSchema
from src.rag.llm import llm
from src.rag.prompt import concierge_prompt, prompt
from src.rag.retriever import get_retriever
from src.user.model import UserModel


def _sse(event: str, payload: dict) -> str:
    """Format one SSE frame: `event: <name>\ndata: <json>\n\n`."""
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _collect_sources(docs: list[Any]) -> list[dict]:
    """Dedupe source citations by (filename, page) so each page appears once."""
    sources: list[dict] = []
    seen: set[tuple] = set()
    for doc in docs:
        meta = doc.metadata or {}
        key = (meta.get("filename"), meta.get("page"))
        if key in seen or key == (None, None):
            continue
        seen.add(key)
        sources.append({"page": meta.get("page"), "filename": meta.get("filename")})
    return sources


def _build_context(docs: list[Any]) -> str:
    """Join retrieved chunks into the '[Page N] text\\n\\n...' block."""
    parts = []
    for doc in docs:
        page = (doc.metadata or {}).get("page", "?")
        parts.append(f"[Page {page}] {doc.page_content}")
    return "\n\n".join(parts)


async def stream_question(
    request: QueryRequestSchema,
    user: UserModel,
) -> AsyncIterator[str]:
    """SSE generator for /chat/query.

    Event order preserved from the original implementation:
        sources -> token x N -> done    (or error + done on mid-stream failure)

    After the stream finishes, the Human/AI message pair is checkpointed via
    graph.update_state under thread_id = user-{id}-conversation-{id}.
    """
    thread_id = make_thread_id(user.id, request.conversation_id)

    try:
        # ----- RAG mode: retrieve + sources (before tokens) -----
        if request.document_id is not None:
            question = request.question
            document_id = request.document_id

            def _retrieve() -> list[Any]:
                retriever = get_retriever(question, document_id)
                return retriever.invoke(question)

            docs = await asyncio.to_thread(_retrieve)
            sources = _collect_sources(docs)

            if not docs:
                # No chunks found: standard fallback message.
                yield _sse("sources", {"sources": [], "document_id": document_id})
                fallback = "I could not find enough information in the document to answer this question."
                yield _sse("token", {"delta": fallback})
                yield _sse("done", {"document_id": document_id})
                await _checkpoint(
                    thread_id=thread_id,
                    user=user,
                    question=question,
                    answer=fallback,
                    document_id=document_id,
                )
                return

            context = _build_context(docs)
            yield _sse("sources", {"sources": sources, "document_id": document_id})

            prompt_input = prompt.invoke({"context": context, "question": question})
        else:
            # Concierge mode: no document, no retrieval, no citations.
            yield _sse("sources", {"sources": [], "document_id": None})
            prompt_input = concierge_prompt.invoke({"question": request.question})

        # ----- Stream the answer -----
        full_answer = ""
        async for chunk in llm.astream(prompt_input):
            delta = chunk.content or ""
            if not delta:
                continue
            full_answer += delta
            yield _sse("token", {"delta": delta})

        yield _sse("done", {"document_id": request.document_id})

        # ----- Persist short-term memory for the next turn -----
        await _checkpoint(
            thread_id=thread_id,
            user=user,
            question=request.question,
            answer=full_answer,
            document_id=request.document_id,
        )

    except Exception as exc:
        print(traceback.format_exc())
        yield _sse("error", {"message": "The model failed while generating a response. Please try again."})
        try:
            yield _sse(
                "done",
                {"document_id": request.document_id if request.document_id is not None else None},
            )
        except (GeneratorExit, RuntimeError):
            pass


async def _checkpoint(
    *,
    thread_id: str,
    user: UserModel,
    question: str,
    answer: str,
    document_id: Optional[int],
) -> None:
    """Write the completed Human/AI exchange to the thread checkpoint.

    Uses graph.update_state (not ainvoke) so no extra Mistral/Qdrant call runs
    and the message pair is stored exactly as streamed. Called after `done` is
    sent so a previous checkpoint write can never delay the response.

    The add_messages reducer merges the new pair on top of any prior state in
    the thread, giving us rolling conversation memory.
    """
    try:
        graph = get_compiled_graph()
        config = {"configurable": {"thread_id": thread_id}}
        values = {
            "messages": [HumanMessage(content=question), AIMessage(content=answer)],
            "document_id": document_id,
            "question": question,
            "answer": answer,
        }
        # as_node="generate_answer" tags the write so the checkpoint reads as
        # if the generate node produced it — node names don't matter for
        # memory, but it keeps checkpoint metadata honest.
        await graph.update_state(
            config,
            values,
            as_node="generate_answer",
        )
    except Exception as exc:
        # A checkpoint failure must never surface to the client — the answer
        # already streamed fine. Log, then move on (memory just won't update).
        print(f"[checkpoint] Failed to persist thread {thread_id}: {exc}")
        print(traceback.format_exc())
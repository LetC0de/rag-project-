"""SSE orchestrator for the LangGraph-backed chat endpoint.

Flow per request:
    1. (router) validate conversation + document ownership.
    2. (here) load the conversation's prior messages from PostgresSaver under
       the thread_id — this IS the short-term memory read.
    3. RAG mode: retrieve chunks from Qdrant (filtered by document_id) inside a
       worker thread so we don't block the event loop; build the context string;
       emit `event: sources`.
    4. Build the LLM message list = (recent history) + (current prompt's
       system/human turns). This is what gives the model conversational context
       ("it" refers to the thing we discussed two turns ago).
    5. Stream tokens from Mistral via `llm.astream` -> `event: token` ...
    6. Emit `event: done`.
    7. Persist the completed exchange (Human + AI message pair) with
       `graph.aupdate_state()` under the thread_id, so PostgresSaver checkpoints
       it for the next turn. This is the short-term memory write.

Single Mistral call per request; single Qdrant retrieval; single checkpoint.

Why `aupdate_state` instead of running `graph.ainvoke`?
    ainvoke would re-run `generate_answer`, calling Mistral a second time and
    producing a *different* answer (LLMs are non-deterministic), then append a
    second AIMessage on top of the already-streamed one. That's the "answer sent
    twice / wrong memory" failure mode. `aupdate_state` writes exactly the value
    we give it, marked as if `generate_answer` produced it, with no additional
    model or retrieval calls. The real token stream to the client uses the same
    `llm.astream` the original SSE code used.

Recent-history windowing:
    We never feed the entire message log to the model — an old conversation can
    grow past the context window. We keep the LAST `MAX_HISTORY_MESSAGES`
    messages (default 20) and prepend those to the current prompt. For a larger
    history later, summarization is the next optimization (not in this build).
"""
from __future__ import annotations

import asyncio
import json
import traceback
from typing import Any, AsyncIterator, Optional

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)

from src.graph.checkpointer import make_thread_id
from src.graph.graph import get_compiled_graph
from src.query.schema import QueryRequestSchema
from src.rag.llm import llm
from src.rag.prompt import concierge_prompt, prompt
from src.rag.retriever import get_retriever
from src.user.model import UserModel

# Keep the most recent N messages as short-term memory context. Beyond this we
# rely on the current retrieval + (later) summarization, not the raw log.
MAX_HISTORY_MESSAGES = 20


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


def _recent_history(messages: list[BaseMessage], limit: int) -> list[BaseMessage]:
    """Keep only the most recent `limit` messages.

    The checkpoint stores the full log; we trim here so we never blow the model
    context window on long conversations (req #13).
    """
    if limit and len(messages) > limit:
        return messages[-limit:]
    return messages


def _history_to_lc_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
    """Normalise checkpoint messages for the LLM input.

    AIMessage/HumanMessage pass through. The checkpointer may store a raw dict
    or a SystemMessage; we keep Human/AI and drop stray System messages (the
    current prompt supplies its own system turn). Everything is coerced to a
    stable LangChain message type so the chat model accepts the history.
    """
    out: list[BaseMessage] = []
    for m in messages:
        if isinstance(m, (HumanMessage, AIMessage, SystemMessage)):
            out.append(m)
            continue
        # Defensive: if a checkpoint ever yields a plain dict, coerce by role.
        if isinstance(m, dict):
            role = m.get("type") or m.get("role")
            content = m.get("content", "")
            if role == "human":
                out.append(HumanMessage(content=content))
            elif role == "ai":
                out.append(AIMessage(content=content))
    return out


async def stream_question(
    request: QueryRequestSchema,
    user: UserModel,
) -> AsyncIterator[str]:
    """SSE generator for /chat/query.

    Event order preserved from the original implementation:
        sources -> token x N -> done    (or error + done on mid-stream failure)

    After the stream finishes, the Human/AI message pair is checkpointed via
    graph.aupdate_state under thread_id = user-{id}-conversation-{id}.
    """
    thread_id = make_thread_id(user.id, request.conversation_id)

    try:
        # ----- Short-term memory READ -----
        # Pull the prior turns for this conversation from PostgresSaver. This is
        # what makes "What is my name?" resolve to the earlier "I'm Abhishek."
        graph = get_compiled_graph()
        config = {"configurable": {"thread_id": thread_id}}
        prior_state = await graph.aget_state(config)
        prior_messages = (
            prior_state.values.get("messages", []) if prior_state else []
        )
        history = _history_to_lc_messages(
            _recent_history(prior_messages, MAX_HISTORY_MESSAGES)
        )

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

            # RAG prompt template renders to [system, human]; we keep its system
            # turn (the document-grounding instructions) and inject history +
            # the fresh human question AFTER it.
            prompt_value = prompt.invoke({"context": context, "question": question})
            prompt_messages = list(prompt_value.messages)
            # Strip any leading system turn from history to avoid two systems;
            # keep the prompt's system turn as authoritative.
            history_no_system = [
                m for m in history if not isinstance(m, SystemMessage)
            ]
            llm_input = prompt_messages[:-1] + history_no_system + [prompt_messages[-1]]
        else:
            # Concierge mode: no document, no retrieval, no citations.
            yield _sse("sources", {"sources": [], "document_id": None})
            prompt_value = concierge_prompt.invoke({"question": request.question})
            prompt_messages = list(prompt_value.messages)
            history_no_system = [
                m for m in history if not isinstance(m, SystemMessage)
            ]
            llm_input = prompt_messages[:-1] + history_no_system + [prompt_messages[-1]]

        # ----- Stream the answer (single Mistral call) -----
        full_answer = ""
        async for chunk in llm.astream(llm_input):
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

    Uses graph.aupdate_state (not ainvoke) so no extra Mistral/Qdrant call runs
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
        await graph.aupdate_state(
            config,
            values,
            as_node="generate_answer",
        )
    except Exception as exc:
        # A checkpoint failure must never surface to the client — the answer
        # already streamed fine. Log, then move on (memory just won't update).
        print(f"[checkpoint] Failed to persist thread {thread_id}: {exc}")
        print(traceback.format_exc())

"""LangGraph nodes — thin wrappers around the existing RAG primitives.

The retrieve / context-build / generate steps previously lived inline in
`src/query/controller.stream_question` and now in `src/graph/streaming.py`.
We don't reimplement retrieval here; we call the same `get_retriever` +
prompt functions. That keeps a single source of truth.

These nodes exist to keep the compiled graph structurally complete
(START -> retrieve_documents -> build_context -> generate_answer -> END).
If you switch to graph-streamed execution later (instead of the current
controller-stream + graph.update_state memory write), the generate node uses
the shared prompt too, so nothing about the RAG logic needs to change.

State convention:
    - `question` is set by the entry step / update_state before the graph runs.
    - `messages` is mutated by `add_messages` (HumanMessage + AIMessage).
    - Retrieved documents are stored as plain dicts (page_content + metadata)
      so PostgresSaver can serialise them. LangChain Document objects don't
      pickle cleanly.
"""
from __future__ import annotations

import traceback
from typing import Any

from langchain_core.messages import AIMessage

from src.graph.state import RAGState
from src.rag.llm import llm
from src.rag.prompt import concierge_prompt, prompt
from src.rag.retriever import get_retriever


def _doc_to_dict(doc: Any) -> dict:
    """Convert a LangChain Document to a plain dict so it's serialisable."""
    return {
        "page_content": getattr(doc, "page_content", ""),
        "metadata": getattr(doc, "metadata", {}) or {},
    }


def retrieve_node(state: RAGState) -> dict:
    """Retrieve top-k chunks from Qdrant, filtered by document_id.

    Concierge mode (document_id is None): no retrieval, no sources. Just
    marks the state as empty so build_context_node can take the no-doc path.
    """
    document_id = state.get("document_id")
    question = state.get("question") or ""

    if document_id is None:
        return {"retrieved_documents": [], "sources": [], "context": ""}

    retriever = get_retriever(question, document_id)
    docs = retriever.invoke(question)

    retrieved = [_doc_to_dict(d) for d in docs]
    sources = _collect_sources(retrieved)
    return {
        "retrieved_documents": retrieved,
        "sources": sources,
    }


def build_context_node(state: RAGState) -> dict:
    """Render retrieved chunks into a single context string for the LLM.

    Each chunk is prefixed with its source page so the prompt can be told to
    cite inline. Empty in concierge mode.
    """
    retrieved = state.get("retrieved_documents") or []
    if not retrieved:
        return {"context": ""}

    parts = []
    for doc in retrieved:
        page = (doc.get("metadata") or {}).get("page", "?")
        parts.append(f"[Page {page}] {doc.get('page_content', '')}")
    return {"context": "\n\n".join(parts)}


async def generate_node(state: RAGState) -> dict:
    """Generate the final answer with Mistral and append it to messages.

    The actual token-by-token streaming happens at the graph-call site (the
    SSE controller). This node produces the *complete* answer and stores it
    in the AIMessage — checkpointed by PostgresSaver so future turns see it
    in `messages`.

    Two branches:
      - concierge (no document): use the product persona prompt.
      - RAG: use the document-context prompt with citations.
    """
    question = state.get("question") or ""
    context = state.get("context") or ""
    document_id = state.get("document_id")

    try:
        if document_id is None or not context:
            final_prompt = concierge_prompt.invoke({"question": question})
        else:
            final_prompt = prompt.invoke(
                {"context": context, "question": question}
            )

        # ainvoke returns a single AIMessage — fine for the checkpointed
        # record. Streaming happens via the controller, not here.
        result = await llm.ainvoke(final_prompt)
        answer = result.content if isinstance(result.content, str) else str(result.content)
    except Exception:
        # Surface the failure for upstream logging but don't crash the whole
        # request — the SSE layer will emit an `error` event.
        print(traceback.format_exc())
        answer = "I couldn't generate a response right now. Please try again."

    return {
        "messages": [AIMessage(content=answer)],
        "answer": answer,
    }
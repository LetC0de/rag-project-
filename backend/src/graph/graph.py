"""Compiled LangGraph graph.

Flow:
    START
      │
      ▼
    retrieve_documents  → Qdrant (filtered by document_id)
      │
      ▼
    build_context       → join retrieved chunks into one context string
      │
      ▼
    generate_answer     → Mistral (concierge or RAG prompt), appends AIMessage
      │
      ▼
     END

The graph is compiled ONCE at application startup with the singleton
PostgresSaver. Every request invokes the compiled `graph` with a config dict
that includes `configurable.thread_id`. The checkpointer loads prior state
under that thread automatically — no manual history plumbing needed.

Important streaming note:
    The `generate_answer` node uses `llm.ainvoke` (full response, not
    streaming) so the AIMessage gets checkpointed. Token-by-token streaming
    happens in `streaming.py`, which calls Mistral directly using the same
    prompt + context. That keeps checkpointing + streaming from doubling up
    on the same content.
"""
from __future__ import annotations

from functools import lru_cache

from langgraph.graph import END, START, StateGraph

from src.graph.checkpointer import get_checkpointer, init_checkpointer
from src.graph.nodes import build_context_node, generate_node, retrieve_node
from src.graph.state import RAGState


@lru_cache(maxsize=1)
def get_compiled_graph():
    """Compile the graph once per process; return the same object thereafter.

    `lru_cache` here is just a belt-and-suspenders guard against accidental
    double-init. The checkpointer module is the real source of truth.
    """
    init_checkpointer()
    checkpointer = get_checkpointer()

    builder = StateGraph(RAGState)

    builder.add_node("retrieve_documents", retrieve_node)
    builder.add_node("build_context", build_context_node)
    builder.add_node("generate_answer", generate_node)

    builder.add_edge(START, "retrieve_documents")
    builder.add_edge("retrieve_documents", "build_context")
    builder.add_edge("build_context", "generate_answer")
    builder.add_edge("generate_answer", END)

    return builder.compile(checkpointer=checkpointer)


def reset_graph_cache() -> None:
    """For tests — drop the cached compiled graph."""
    get_compiled_graph.cache_clear()
"""Graph state.

Extends LangGraph's MessagesState with the small amount of RAG-specific state
needed across nodes. Keep this serialisable: PostgresSaver checkpoints it on
every turn. Don't put SQLAlchemy ORM rows or Pydantic models here — only
plain dicts, lists, strings, and primitives.
"""
from __future__ import annotations

from typing import Annotated, Any, Optional, TypedDict

from langgraph.graph import MessagesState
from langgraph.graph.message import add_messages


class RAGState(MessagesState):
    """Messages + RAG scratch fields.

    - messages: full chat history (managed by add_messages reducer — append
      on HumanMessage/AIMessage, replace on re-runs).
    - document_id: which document is the current question targeting. May be
      None for concierge mode (no retrieval). Re-read on each turn so users
      can switch documents inside the same conversation without losing memory.
    - question: latest user question (last HumanMessage.content also holds it;
      we keep this explicitly because the retrieve node runs before the
      final message is committed).
    - retrieved_documents: list of LangChain Document objects (page_content +
      metadata). Populated by retrieve_node, consumed by build_context_node.
      Not persisted across re-runs because reducer overwrites with the latest.
    - sources: deduped list of {filename, page} for the SSE `sources` event.
    - context: rendered "[Page N] text\\n\\n..." block fed into the LLM.
    - answer: final assistant text (also lives in the AIMessage, but kept
      here for the streaming consumer to grab once the graph completes).
    """

    document_id: Optional[int]
    question: str
    retrieved_documents: list[Any]
    sources: list[dict]
    context: str
    answer: str
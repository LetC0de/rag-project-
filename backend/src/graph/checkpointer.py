"""PostgreSQL checkpointer for LangGraph.

PostgresSaver persists the entire graph state (including `messages`) per
thread_id. This is the short-term memory layer. Application-level
conversation metadata lives in the `conversations` table — that table does
NOT store message contents.

Lifecycle:
    - init_checkpointer() is called ONCE at FastAPI startup (in the lifespan).
    - setup() is called there too — it creates the LangGraph tables (idempotent).
    - get_checkpointer() returns the live singleton for the compiled graph.
    - delete_thread() wipes the checkpoint history for a deleted conversation.

Why a module-level singleton? Creating a PostgresSaver per request is
expensive (TCP pool handshake + table scan). Compile the graph against the
singleton; both are reused across every request.
"""
from __future__ import annotations

import logging
from typing import Optional

from langgraph.checkpoint.postgres import PostgresSaver

from src.utils.settings import settings


log = logging.getLogger(__name__)

# Module-level singleton — initialised by init_checkpointer() in the FastAPI
# lifespan, before the first request arrives.
_checkpointer: Optional[PostgresSaver] = None


def _build_connection_string() -> str:
    """Translate the SQLAlchemy DB_CONNECTION into a libpq-style URL psycopg3
    can open directly.

    The existing settings.DB_CONNECTION is a SQLAlchemy URL like
    `postgresql://user:pass@host:5432/db?sslmode=require`. PostgresSaver wants
    a plain libpq connection string — usually the same shape works.
    """
    return settings.DB_CONNECTION


def init_checkpointer() -> PostgresSaver:
    """Create the PostgresSaver, run setup() once, return the singleton.

    Safe to call multiple times: subsequent calls return the cached instance
    so a hot-reload or test fixture double-call doesn't double-initialise.
    """
    global _checkpointer, _pool

    if _checkpointer is not None:
        return _checkpointer

    conn_string = _build_connection_string()

    # PostgresSaver.from_conn_string(...) opens a connection pool internally
    # and calls setup() against it. We wrap setup() ourselves so we can call
    # it once at boot (per the requirement: setup is part of DB init, not
    # per-request).
    saver = PostgresSaver.from_conn_string(conn_string)

    # setup() creates the LangGraph tables (checkpoint, checkpoint_writes,
    # checkpoint_blobs, checkpoint_migrations). Idempotent — running twice
    # is safe.
    saver.setup()

    _checkpointer = saver
    log.info("PostgresSaver initialised; LangGraph checkpoint tables ensured.")
    return _checkpointer


def get_checkpointer() -> PostgresSaver:
    """Return the singleton checkpointer. Raises if init_checkpointer()
    hasn't run yet (i.e. someone is using the graph outside the FastAPI
    lifespan — a programming error)."""
    if _checkpointer is None:
        raise RuntimeError(
            "Checkpointer not initialised. Call init_checkpointer() during "
            "application startup (lifespan) before handling requests."
        )
    return _checkpointer


def delete_thread(user_id: int, conversation_id: int) -> None:
    """Delete all checkpoints for a (user, conversation) thread.

    Called when the user deletes a conversation. Best-effort: if the
    checkpointer isn't ready (e.g. mid-shutdown) we silently skip — orphaned
    checkpoints don't break anything.
    """
    if _checkpointer is None:
        return
    thread_id = make_thread_id(user_id, conversation_id)
    try:
        # PostgresSaver exposes a delete_thread method since 2.0.
        _checkpointer.delete_thread(thread_id)
    except Exception as exc:
        log.warning("Failed to delete thread %s: %s", thread_id, exc)


def make_thread_id(user_id: int, conversation_id: int) -> str:
    """Deterministic, namespaced thread identifier.

    Format: `user-{user_id}-conversation-{conversation_id}`

    Namespacing by user gives an additional isolation layer even before the
    application-level ownership check. Don't rely on this alone — always
    validate ownership in the application DB.
    """
    return f"user-{user_id}-conversation-{conversation_id}"
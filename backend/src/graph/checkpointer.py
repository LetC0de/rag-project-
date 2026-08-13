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

Why a module-level singleton + a long-lived connection pool?
    Creating a PostgresSaver per request is expensive (pool handshake + table
    scan). Compiling the graph against the singleton reuses it across every
    request.

Implementation note (langgraph-checkpoint-postgres):
    `AsyncPostgresSaver.from_conn_string` is an `@asynccontextmanager` that
    builds the saver on top of an internal psycopg async connection POOL. We
    deliberately use this (rather than opening a single raw
    `psycopg.AsyncConnection` and passing it via `conn=`) because a single raw
    connection is NOT safe for concurrent async requests: one request closing
    or timing out the connection takes down every other in-flight request
    ("psycopg.OperationalError: the connection is closed"). The library's pool
    hands out a fresh connection per operation, which is the correct model for
    FastAPI's concurrent async handlers.

    We keep the context manager alive for the whole process: `__aenter__` once
    in init_checkpointer(), `__aexit__` in close_checkpointer() at shutdown.
"""
from __future__ import annotations

import logging
from contextlib import AbstractAsyncContextManager
from typing import Optional

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from src.utils.settings import settings


log = logging.getLogger(__name__)

# Module-level singleton — initialised by init_checkpointer() in the FastAPI
# lifespan, before the first request arrives.
_checkpointer: Optional[AsyncPostgresSaver] = None
# The async context manager returned by from_conn_string; we hold its reference
# so we can __aexit__ it cleanly on shutdown (releasing the pool).
_checkpointer_cm: Optional[AbstractAsyncContextManager[AsyncPostgresSaver]] = None


def _build_connection_string() -> str:
    """The settings DB connection is a libpq/SQLAlchemy style URL.

    AsyncPostgresSaver.from_conn_string passes it straight to psycopg's async
    connect, which handles `postgresql://...?sslmode=require&...` directly.
    """
    return settings.DB_CONNECTION


async def init_checkpointer() -> AsyncPostgresSaver:
    """Create the AsyncPostgresSaver (pooled) and run setup() once.

    Safe to call multiple times: subsequent calls return the cached instance so
    a hot-reload or test fixture double-call doesn't double-initialise.

    The context manager is entered here and only exited in close_checkpointer(),
    so the underlying connection pool stays open for the app's lifetime — which
    is what makes concurrent requests work without "connection is closed".
    """
    global _checkpointer, _checkpointer_cm

    if _checkpointer is not None:
        return _checkpointer

    conn_string = _build_connection_string()

    # Enter the async context manager: builds the saver on top of a connection
    # pool (not a single connection). This pool is the key fix — concurrent
    # requests each get their own pooled connection.
    _checkpointer_cm = AsyncPostgresSaver.from_conn_string(conn_string)
    saver = await _checkpointer_cm.__aenter__()

    # setup() creates the LangGraph tables (checkpoint, checkpoint_writes,
    # checkpoint_blobs, checkpoint_migrations). Idempotent — running twice
    # is safe.
    await saver.setup()

    _checkpointer = saver
    log.info("AsyncPostgresSaver initialised (pooled); LangGraph checkpoint tables ensured.")
    return _checkpointer


def get_checkpointer() -> AsyncPostgresSaver:
    """Return the singleton checkpointer.

    Raises if init_checkpointer() hasn't run yet (i.e. someone is using the
    graph outside the FastAPI lifespan — a programming error).
    """
    if _checkpointer is None:
        raise RuntimeError(
            "Checkpointer not initialised. Call init_checkpointer() during "
            "application startup (lifespan) before handling requests."
        )
    return _checkpointer


def make_thread_id(user_id: int, conversation_id: int) -> str:
    """Deterministic, namespaced thread identifier.

    Format: `user-{user_id}-conversation-{conversation_id}`

    Namespacing by user gives an additional isolation layer even before the
    application-level ownership check. Don't rely on this alone — always
    validate ownership in the application DB.
    """
    return f"user-{user_id}-conversation-{conversation_id}"


async def delete_thread(user_id: int, conversation_id: int) -> None:
    """Delete all checkpoints for a (user, conversation) thread.

    Called when the user deletes a conversation. Best-effort: if the
    checkpointer isn't ready (e.g. mid-shutdown) we silently skip — orphaned
    checkpoints don't break anything.
    """
    if _checkpointer is None:
        return
    thread_id = make_thread_id(user_id, conversation_id)
    try:
        await _checkpointer.adelete_thread(thread_id)
    except Exception as exc:
        log.warning("Failed to delete thread %s: %s", thread_id, exc)


async def close_checkpointer() -> None:
    """Release the connection pool at app shutdown (best-effort).

    Exits the async context manager opened in init_checkpointer(), which closes
    the underlying psycopg pool cleanly so no connections leak on shutdown.
    """
    global _checkpointer, _checkpointer_cm
    if _checkpointer_cm is not None:
        try:
            await _checkpointer_cm.__aexit__(None, None, None)
        except Exception as exc:
            log.warning("Error closing checkpointer pool: %s", exc)
    _checkpointer = None
    _checkpointer_cm = None

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

Why a module-level singleton + a single long-lived connection?
    Creating a PostgresSaver (and a connection) per request is expensive (TCP
    pool handshake + table scan). Compile the graph against the singleton;
    both are reused across every request.

Implementation note (langgraph >= 1.x / langgraph-checkpoint-postgres >= 3.x):
    `PostgresSaver.from_conn_string` is a `@contextmanager` yielding the *sync*
    `PostgresSaver`. Our app is async (FastAPI + `await graph.aupdate_state`/
    `aget_state`), so we use the **`AsyncPostgresSaver`** directly: open one
    `psycopg.AsyncConnection` once, hand it to `AsyncPostgresSaver(conn=...)`,
    and keep the connection alive for the process lifetime. This mirrors the
    library's own `from_conn_string` internals but lets us own the connection's
    lifecycle.
"""
from __future__ import annotations

import logging
from typing import Optional

import psycopg
from psycopg.rows import dict_row
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from src.utils.settings import settings


log = logging.getLogger(__name__)

# Module-level singleton — initialised by init_checkpointer() in the FastAPI
# lifespan, before the first request arrives.
_checkpointer: Optional[AsyncPostgresSaver] = None
_connection: Optional[psycopg.AsyncConnection] = None


def _build_connection_string() -> str:
    """The settings.DB_CONNECTION is a libpq/SQLAlchemy style URL.

    psycopg's async connect handles `postgresql://...?sslmode=require&...`
    directly, so we can pass it through unchanged.
    """
    return settings.DB_CONNECTION


async def init_checkpointer() -> AsyncPostgresSaver:
    """Create the AsyncPostgresSaver + open the connection, run setup() once.

    Safe to call multiple times: subsequent calls return the cached instance so
    a hot-reload or test fixture double-call doesn't double-initialise.
    """
    global _checkpointer, _connection

    if _checkpointer is not None:
        return _checkpointer

    conn_string = _build_connection_string()

    # Open a single async connection that lives for the app's lifetime.
    # autocommit=True is required by the checkpointer; prepare_threshold=0 and
    # dict_row match the library's own from_conn_string defaults.
    _connection = await psycopg.AsyncConnection.connect(
        conn_string,
        autocommit=True,
        prepare_threshold=0,
        row_factory=dict_row,
    )

    saver = AsyncPostgresSaver(conn=_connection)

    # setup() creates the LangGraph tables (checkpoint, checkpoint_writes,
    # checkpoint_blobs, checkpoint_migrations). Idempotent — running twice
    # is safe.
    await saver.setup()

    _checkpointer = saver
    log.info("AsyncPostgresSaver initialised; LangGraph checkpoint tables ensured.")
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
    """Release the connection at app shutdown (best-effort).

    PostgresSaver manages its own pool/connection; we just close the one we
    opened so it doesn't leak on shutdown.
    """
    global _checkpointer, _connection
    if _connection is not None:
        try:
            await _connection.close()
        except Exception as exc:
            log.warning("Error closing checkpointer connection: %s", exc)
    _checkpointer = None
    _connection = None

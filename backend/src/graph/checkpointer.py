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
from typing import Optional

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

from src.utils.settings import settings


log = logging.getLogger(__name__)

# Module-level singleton — initialised by init_checkpointer() in the FastAPI
# lifespan, before the first request arrives.
_checkpointer: Optional[AsyncPostgresSaver] = None
# The connection pool backing the saver; held so we can close it cleanly on
# shutdown (releasing every pooled connection).
_pool: Optional[AsyncConnectionPool] = None


def _build_connection_string() -> str:
    """The settings DB connection is a libpq/SQLAlchemy style URL.

    AsyncPostgresSaver.from_conn_string passes it straight to psycopg's async
    connect, which handles `postgresql://...?sslmode=require&...` directly.
    """
    return settings.DB_CONNECTION


async def init_checkpointer() -> AsyncPostgresSaver:
    """Create the AsyncPostgresSaver and run setup() once.

    Safe to call multiple times: subsequent calls return the cached instance so
    a hot-reload or test fixture double-call doesn't double-initialise.

    CRITICAL: we back the saver with an AsyncConnectionPool, NOT a single
    connection. The library's AsyncPostgresSaver._cursor() opens a *fresh*
    connection from the pool on every operation (see get_connection). A single
    long-lived connection shared across concurrent requests was the cause of the
    intermittent `psycopg.OperationalError: the connection is closed` — one
    request closing/committing the shared connection took down every other
    in-flight request. The pool hands each concurrent request its own connection
    and returns it afterwards, which is the correct model for FastAPI's
    concurrent async handlers.
    """
    global _checkpointer, _pool

    if _checkpointer is not None:
        return _checkpointer

    conn_string = _build_connection_string()

    # One pool for the whole process. open=False so we control startup; we open
    # it explicitly and run setup() against it. SSL is read from the connection
    # string itself (e.g. `?sslmode=require`), so no extra ssl kwarg is needed.
    # autocommit=True matches the original single-connection behaviour
    # (from_conn_string set it) so checkpoint writes commit immediately instead
    # of lingering in an uncommitted transaction.
    _pool = AsyncConnectionPool(
        conn_string,
        open=False,
        max_size=20,
        kwargs={"autocommit": True},
    )
    await _pool.open()

    saver = AsyncPostgresSaver(conn=_pool)

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

    Closes the AsyncConnectionPool opened in init_checkpointer(), returning all
    pooled connections to Postgres cleanly so no connections leak on shutdown.
    """
    global _checkpointer, _pool
    if _pool is not None:
        try:
            await _pool.close()
        except Exception as exc:
            log.warning("Error closing checkpointer pool: %s", exc)
    _checkpointer = None
    _pool = None

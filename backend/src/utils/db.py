from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from src.utils.settings import settings

base = declarative_base()

# Cloud Postgres (Neon/Render) closes connections that sit idle for a while,
# which left SQLAlchemy handing out dead pooled connections ("server closed
# the connection unexpectedly"). pool_pre_ping health-checks a connection
# before issuing a query and transparently reopens it if it's stale;
# pool_recycle discards connections older than the server's idle cutoff.
engine = create_engine(
    url=settings.DB_CONNECTION,
    pool_pre_ping=True,
    pool_recycle=540,   # 9 min — below Neon's ~5 min / Render's idle timeout
    pool_size=5,
    max_overflow=10,
)

local_session = sessionmaker(bind=engine)


def get_db():
    session = local_session()
    try:
        yield session
    finally:
        session.close()

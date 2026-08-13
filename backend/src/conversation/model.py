from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from src.utils.db import base


class ConversationModel(base):
    """Application-level conversation metadata.

    This is *business* data — which chat session belongs to which user, its
    title, and timestamps. It is NOT where chat messages live: the LangGraph
    PostgresSaver checkpoints message state separately (thread_id keyed by
    user+conversation). Don't manually duplicate every message here.
    """

    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False, default="New Chat")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

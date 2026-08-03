from datetime import datetime

from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from src.utils.db import base


class Document(base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    user_id = Column(Integer, nullable=False)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.now())
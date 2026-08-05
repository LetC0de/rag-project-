from sqlalchemy import Column, Integer, String, DateTime, func
from src.utils.db import base


class UserModel(base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    username = Column(String, nullable=False)
    password = Column(String, nullable=False)
    email = Column(String)
    role = Column(String, nullable=False, server_default="USER", default="USER")          # USER | ADMIN
    last_seen = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

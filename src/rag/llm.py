from langchain_mistralai import ChatMistralAI
from src.utils.settings import settings

llm = ChatMistralAI(model=settings.LLM_MODEL)

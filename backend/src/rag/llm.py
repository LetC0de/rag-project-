from langchain_mistralai import ChatMistralAI
from src.utils.settings import settings

llm = ChatMistralAI(
    model=settings.LLM_MODEL,
    api_key=settings.MISTRAL_API_KEY
)

from langchain_mistralai import MistralAIEmbeddings
from src.utils.settings import settings

embeddings = MistralAIEmbeddings(
    model=settings.MISTRAL_MODEL,
    api_key=settings.MISTRAL_API_KEY
)

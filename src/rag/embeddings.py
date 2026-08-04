from langchain_mistralai import MistralAIEmbeddings
from src.utils.settings import settings

embeddings = MistralAIEmbeddings(
    model=settings.MISTRAL_MODEL
)

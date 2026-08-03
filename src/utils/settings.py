from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env",extra="ignore")

    MISTRAL_API_KEY: str
    QDRANT_URL: str
    QDRANT_API_KEY: str
    DB_CONNECTION: str


settings = Settings()
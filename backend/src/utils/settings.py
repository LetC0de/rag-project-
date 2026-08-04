from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    MISTRAL_API_KEY: str
    MISTRAL_MODEL: str
    LLM_MODEL: str
    QDRANT_URL: str
    QDRANT_API_KEY: str
    DB_CONNECTION: str

    # Allowed browser origins (JSON list). Override in .env for the deployed
    # frontend, e.g. CORS_ORIGINS=["https://enterpriseassistant.vercel.app"]
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Primary frontend origin (used for links / docs). Same default as above.
    FRONTEND_URL: str = "http://localhost:5173"


settings = Settings()
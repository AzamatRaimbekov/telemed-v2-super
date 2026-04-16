from __future__ import annotations
from pydantic_settings import BaseSettings
from pydantic import field_validator
import json


class Settings(BaseSettings):
    APP_NAME: str = "MedCore KG"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "medcore"
    POSTGRES_USER: str = "medcore"
    POSTGRES_PASSWORD: str = "medcore_secret"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "medcore"
    MINIO_USE_SSL: bool = False
    CELERY_BROKER_URL: str = "redis://localhost:6379/2"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:80"]
    SENTRY_DSN: str = ""

    # OpenAI (Whisper STT)
    OPENAI_API_KEY: str = ""

    # SMTP Email
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@medcore.kg"
    SMTP_FROM_NAME: str = "MedCore KG"
    SMTP_USE_TLS: bool = True

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            if v.strip() == "*":
                return ["*"]
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @property
    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def sync_database_url(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def redis_url(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

settings = Settings()

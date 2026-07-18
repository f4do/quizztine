from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    backend_url: str = "http://web-backend:3000"
    log_level: str = "INFO"

    model_config = {"env_prefix": "quiz_engine_", "env_file": ".env"}


settings = Settings()

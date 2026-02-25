from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    bot_token: str
    webapp_url: str = "https://smr-sfera.lovable.app"

    database_url: str = ""
    database_url_sync: str = ""

    redis_url: str = "redis://localhost:6379/0"

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_secret_key: str = "change-me"

    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "gpr-documents"

    # Aliases for fact.py
    @property
    def minio_endpoint(self) -> str:
        return self.s3_endpoint

    @property
    def minio_access_key(self) -> str:
        return self.s3_access_key

    @property
    def minio_secret_key(self) -> str:
        return self.s3_secret_key

    check_deadlines_interval: int = 3600
    digest_hour: int = 9

    admin_telegram_ids: str = ""

    # AI provider
    ai_provider: str = "kimi"
    ai_api_key: str = ""
    ai_model: str = "moonshot-v1-32k"
    ai_base_url: str = "https://api.moonshot.ai/v1"

    @property
    def admin_ids(self) -> list[int]:
        if not self.admin_telegram_ids:
            return []
        return [int(x.strip()) for x in self.admin_telegram_ids.split(",") if x.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()

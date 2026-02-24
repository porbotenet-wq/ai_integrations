from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    bot_token: str
    webapp_url: str = ""

    database_url: str = "postgresql+asyncpg://gpr_user:gpr_pass@localhost:5432/gpr_bot"
    database_url_sync: str = "postgresql://gpr_user:gpr_pass@localhost:5432/gpr_bot"

    redis_url: str = "redis://localhost:6379/0"

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_secret_key: str = "change-me"

    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "gpr-documents"

    check_deadlines_interval: int = 3600
    digest_hour: int = 9

    admin_telegram_ids: str = ""

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

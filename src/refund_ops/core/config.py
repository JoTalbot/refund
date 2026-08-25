from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Refund Operations Platform API"
    api_version: str = "v1"
    database_url: str = "sqlite+pysqlite:///./refund_ops.db"

    model_config = SettingsConfigDict(
        env_prefix="REFUND_OPS_",
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()

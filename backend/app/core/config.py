from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Autarkic Trading Agent"
    API_V1_STR: str = "/api/v1"
    
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD_FILE: str = "/run/secrets/db_password"
    POSTGRES_SERVER: str = "ledger-db"
    POSTGRES_DB: str = "trading_db"
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # Read password from secret file
        try:
            with open(self.POSTGRES_PASSWORD_FILE) as f:
                password = f.read().strip()
        except FileNotFoundError:
            password = "supersecretpassword" # Fallback for local dev without secrets mounted properly
            
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{password}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"

    class Config:
        case_sensitive = True

settings = Settings()

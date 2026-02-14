"""
ML Service Configuration
Loads from environment variables with sensible defaults.
"""
import os
from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    """Application settings loaded from environment."""
    
    # Service
    service_name: str = "psx-ml-service"
    environment: Literal["development", "production"] = "development"
    log_level: str = "INFO"
    
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # QuestDB (PostgreSQL wire protocol)
    questdb_host: str = "localhost"
    questdb_port: int = 8812
    questdb_user: str = "admin"
    questdb_password: str = "quest"
    questdb_database: str = "qdb"
    
    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    
    # Feature Engineering
    bar_type: Literal["time", "tick", "volume"] = "time"
    bar_interval_seconds: int = 60  # 1-minute bars default
    feature_window: int = 20        # lookback for indicators
    
    # Model
    model_path: str = "./models"
    model_name: str = "xgb_baseline_v1"
    prediction_threshold: float = 0.6
    
    # Move Detection (Labeling)
    move_threshold_pct: float = 1.0   # 1% price move
    move_horizon_bars: int = 10       # within N bars
    atr_multiplier: float = 2.0       # or 2x ATR
    
    @property
    def questdb_dsn(self) -> str:
        return f"postgresql://{self.questdb_user}:{self.questdb_password}@{self.questdb_host}:{self.questdb_port}/{self.questdb_database}"
    
    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"
    
    class Config:
        env_file = ".env"
        env_prefix = "ML_"


settings = Settings()

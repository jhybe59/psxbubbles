"""
Data Contracts / Schemas
Shared between Node.js and Python via Redis/API.
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


# ============ INPUT SCHEMAS ============

class TickData(BaseModel):
    """Raw tick from exchange feed."""
    symbol: str
    price: float
    volume: float
    timestamp: datetime
    side: Optional[Literal["buy", "sell"]] = None


class BarData(BaseModel):
    """Aggregated OHLCV bar."""
    symbol: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    vwap: Optional[float] = None
    trade_count: Optional[int] = None


# ============ FEATURE SCHEMAS ============

class FeatureVector(BaseModel):
    """Computed features for a single bar/window."""
    symbol: str
    timestamp: datetime
    
    # Price momentum
    return_1: float = Field(..., description="1-bar return")
    return_5: float = Field(..., description="5-bar return")
    return_10: float = Field(..., description="10-bar return")
    
    # Volatility
    atr_14: float = Field(..., description="14-bar ATR")
    volatility_20: float = Field(..., description="20-bar rolling std")
    
    # Volume
    volume_ratio: float = Field(..., description="Volume vs 20-bar avg")
    vwap_deviation: float = Field(..., description="Price deviation from VWAP")
    
    # Technical
    rsi_14: float = Field(..., description="14-bar RSI")
    macd_signal: float = Field(..., description="MACD - Signal line")
    bb_position: float = Field(..., description="Position within Bollinger Bands (0-1)")
    
    # Microstructure (optional)
    spread_pct: Optional[float] = None
    order_imbalance: Optional[float] = None


# ============ PREDICTION SCHEMAS ============

class PredictionRequest(BaseModel):
    """Request for real-time prediction."""
    symbol: str
    features: FeatureVector


class PredictionResponse(BaseModel):
    """ML model prediction output."""
    symbol: str
    timestamp: datetime
    
    # Primary prediction
    move_probability: float = Field(..., ge=0, le=1, description="Probability of significant move")
    direction: Literal["up", "down", "neutral"]
    confidence: float = Field(..., ge=0, le=1)
    
    # Signal strength
    signal_strength: Literal["weak", "moderate", "strong"]
    
    # Explainability
    top_features: dict[str, float] = Field(default_factory=dict, description="Top contributing features")
    
    # Action recommendation
    recommended_action: Optional[Literal["buy", "sell", "hold", "alert"]] = None


class TrainingLabel(BaseModel):
    """Label for supervised learning."""
    symbol: str
    timestamp: datetime
    
    # Target
    move_occurred: bool
    move_direction: Optional[Literal["up", "down"]] = None
    move_magnitude_pct: Optional[float] = None
    bars_to_move: Optional[int] = None


# ============ STREAMING SCHEMAS ============

class StreamMessage(BaseModel):
    """Redis pub/sub message format."""
    type: Literal["tick", "bar", "prediction", "alert"]
    payload: dict
    timestamp: datetime = Field(default_factory=datetime.utcnow)

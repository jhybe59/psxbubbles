"""
Base Agent Class
Abstract interface for all market intelligence agents.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict, Any
import numpy as np
import pandas as pd


@dataclass
class AgentSignal:
    """Output from an agent."""
    name: str                    # Agent name
    signal_strength: float       # -1 to 1 (bearish to bullish)
    direction: int               # -1, 0, 1
    confidence: float            # 0 to 1
    regime: Optional[str] = None # Current regime assessment
    metadata: Optional[dict] = None
    
    def to_dict(self) -> dict:
        return {
            'name': self.name,
            'signal_strength': self.signal_strength,
            'direction': self.direction,
            'confidence': self.confidence,
            'regime': self.regime,
            'metadata': self.metadata
        }


class BaseAgent(ABC):
    """
    Abstract base class for all market agents.
    
    Each agent:
    - Focuses on specific market aspect
    - Produces signal, direction, confidence
    - Can update with new data
    """
    
    def __init__(self, name: str):
        self.name = name
        self.is_trained = False
        self.last_signal: Optional[AgentSignal] = None
    
    @abstractmethod
    def train(self, df: pd.DataFrame) -> None:
        """Train the agent on historical data."""
        pass
    
    @abstractmethod
    def analyze(self, df: pd.DataFrame) -> AgentSignal:
        """Analyze current market state and return signal."""
        pass
    
    @abstractmethod
    def update(self, new_data: dict) -> None:
        """Update agent with new tick/bar data."""
        pass
    
    def get_signal(self) -> Optional[AgentSignal]:
        """Get last computed signal."""
        return self.last_signal
    
    def reset(self) -> None:
        """Reset agent state."""
        self.last_signal = None


class AgentConfig:
    """Configuration for agent parameters."""
    
    # Volume Agent
    volume_spike_threshold: float = 2.0
    volume_window: int = 20
    
    # Volatility Agent
    volatility_expansion_threshold: float = 1.5
    compression_threshold: float = 0.7
    
    # Momentum Agent
    momentum_window: int = 10
    acceleration_threshold: float = 0.5
    
    # Pattern Agent
    pattern_lookback: int = 50
    similarity_threshold: float = 0.8
    
    # Flow Agent
    imbalance_threshold: float = 0.3

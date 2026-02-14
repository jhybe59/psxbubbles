"""
Volume Agent
Analyzes volume structure, absorption patterns, and spikes.

Signals:
- Volume spike (breakout potential)
- Volume absorption (accumulation/distribution)
- Volume divergence (price-volume mismatch)
- Volume confirmation (trend strength)
"""
import numpy as np
import pandas as pd
from typing import Optional
import structlog

from .base_agent import BaseAgent, AgentSignal, AgentConfig

logger = structlog.get_logger()


class VolumeAgent(BaseAgent):
    """
    Volume Intelligence Agent.
    
    Specializes in:
    - Volume spikes and exhaustion
    - RVOL patterns
    - Volume-price divergence
    - Absorption detection
    """
    
    def __init__(self, config: Optional[AgentConfig] = None):
        super().__init__(name="volume")
        self.config = config or AgentConfig()
        
        # State
        self.avg_volume = 0
        self.volume_history = []
        self.price_history = []
    
    def train(self, df: pd.DataFrame) -> None:
        """Train on historical volume patterns."""
        if 'volume' in df.columns:
            self.avg_volume = df['volume'].mean()
            self.volume_history = df['volume'].tail(100).tolist()
            self.price_history = df['close'].tail(100).tolist()
        self.is_trained = True
        logger.info("volume_agent_trained")
    
    def analyze(self, df: pd.DataFrame) -> AgentSignal:
        """Analyze volume patterns."""
        if df.empty or 'volume' not in df.columns:
            return self._neutral_signal()
        
        df = df.tail(50).copy()  # Work with recent data
        
        # Calculate metrics
        current_vol = df['volume'].iloc[-1]
        vol_sma = df['volume'].rolling(self.config.volume_window).mean().iloc[-1]
        rvol = current_vol / vol_sma if vol_sma > 0 else 1
        
        # Volume trend
        vol_trend = df['volume'].tail(5).mean() / df['volume'].tail(20).mean() if len(df) >= 20 else 1
        
        # Price-volume divergence
        price_change = (df['close'].iloc[-1] - df['close'].iloc[-5]) / df['close'].iloc[-5] if len(df) >= 5 else 0
        vol_change = (df['volume'].tail(5).mean() - df['volume'].tail(20).mean()) / df['volume'].tail(20).mean() if len(df) >= 20 else 0
        
        # Signals
        signal_strength = 0.0
        direction = 0
        confidence = 0.5
        regime = "normal"
        
        # Volume spike detection
        if rvol > self.config.volume_spike_threshold:
            signal_strength = min(0.8, (rvol - 1) / 3)
            direction = 1 if price_change > 0 else -1
            confidence = min(0.9, rvol / 4)
            regime = "spike"
        
        # Volume exhaustion (high volume at extreme)
        elif rvol > 1.5 and abs(price_change) > 0.02:
            # After big move with high volume - potential exhaustion
            signal_strength = -0.3 * np.sign(price_change)  # Contrarian
            direction = -1 if price_change > 0 else 1
            confidence = 0.6
            regime = "exhaustion"
        
        # Volume divergence
        elif price_change > 0.01 and vol_change < -0.2:
            signal_strength = -0.4  # Bearish divergence
            direction = -1
            confidence = 0.65
            regime = "divergence"
        elif price_change < -0.01 and vol_change < -0.2:
            signal_strength = 0.4  # Bullish divergence
            direction = 1
            confidence = 0.65
            regime = "divergence"
        
        # Accumulation pattern
        elif vol_trend > 1.2 and abs(price_change) < 0.005:
            signal_strength = 0.5  # Quiet accumulation
            direction = 1
            confidence = 0.7
            regime = "accumulation"
        
        self.last_signal = AgentSignal(
            name=self.name,
            signal_strength=signal_strength,
            direction=direction,
            confidence=confidence,
            regime=regime,
            metadata={
                'rvol': round(rvol, 2),
                'vol_trend': round(vol_trend, 2),
                'price_change': round(price_change * 100, 2)
            }
        )
        
        return self.last_signal
    
    def update(self, new_data: dict) -> None:
        """Update with new tick data."""
        if 'volume' in new_data:
            self.volume_history.append(new_data['volume'])
            if len(self.volume_history) > 100:
                self.volume_history.pop(0)
        
        if 'price' in new_data:
            self.price_history.append(new_data['price'])
            if len(self.price_history) > 100:
                self.price_history.pop(0)
    
    def _neutral_signal(self) -> AgentSignal:
        return AgentSignal(
            name=self.name,
            signal_strength=0,
            direction=0,
            confidence=0,
            regime="unknown"
        )

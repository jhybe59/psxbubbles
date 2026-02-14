"""
Volatility Agent
Analyzes volatility compression and expansion patterns.

Key signals:
- Compression → potential explosion
- Expansion → trend confirmation  
- Volatility regime changes
"""
import numpy as np
import pandas as pd
from typing import Optional
import structlog

from .base_agent import BaseAgent, AgentSignal, AgentConfig

logger = structlog.get_logger()


class VolatilityAgent(BaseAgent):
    """
    Volatility Intelligence Agent.
    
    Specializes in:
    - Compression detection (squeeze)
    - Expansion detection
    - Volatility regime classification
    - ATR patterns
    """
    
    def __init__(self, config: Optional[AgentConfig] = None):
        super().__init__(name="volatility")
        self.config = config or AgentConfig()
        
        # State
        self.avg_volatility = 0
        self.volatility_history = []
    
    def train(self, df: pd.DataFrame) -> None:
        """Train on historical volatility."""
        if 'atr_14' in df.columns:
            self.avg_volatility = df['atr_14'].mean()
            self.volatility_history = df['atr_14'].tail(100).tolist()
        self.is_trained = True
        logger.info("volatility_agent_trained")
    
    def analyze(self, df: pd.DataFrame) -> AgentSignal:
        """Analyze volatility patterns."""
        if df.empty:
            return self._neutral_signal()
        
        df = df.tail(50).copy()
        
        # Calculate ATR if not present
        if 'atr_14' not in df.columns:
            high_low = df['high'] - df['low']
            df['atr_14'] = high_low.rolling(14).mean()
        
        current_atr = df['atr_14'].iloc[-1]
        avg_atr = df['atr_14'].rolling(20).mean().iloc[-1]
        
        # ATR expansion ratio
        atr_ratio = current_atr / avg_atr if avg_atr > 0 else 1
        
        # Bollinger Band width (if available)
        bb_squeeze = 0
        if 'bb_bandwidth' in df.columns:
            current_bw = df['bb_bandwidth'].iloc[-1]
            avg_bw = df['bb_bandwidth'].rolling(20).mean().iloc[-1]
            bb_squeeze = avg_bw / current_bw if current_bw > 0 else 1
        
        # Volatility trend
        vol_trend = df['atr_14'].tail(5).mean() / df['atr_14'].tail(20).mean() if len(df) >= 20 else 1
        
        # Signals
        signal_strength = 0.0
        direction = 0
        confidence = 0.5
        regime = "normal"
        
        # Compression detection (squeeze)
        if atr_ratio < self.config.compression_threshold or bb_squeeze > 1.5:
            signal_strength = 0.6  # Compression = potential breakout
            direction = 0  # Direction unknown yet
            confidence = 0.75
            regime = "compression"
        
        # Expansion detection
        elif atr_ratio > self.config.volatility_expansion_threshold:
            # Expansion after compression = strong move
            if vol_trend > 1.3:
                signal_strength = 0.7
                direction = 1 if df['close'].iloc[-1] > df['close'].iloc[-5] else -1
                confidence = 0.8
                regime = "expansion"
            else:
                signal_strength = 0.3
                direction = 1 if df['close'].iloc[-1] > df['close'].iloc[-3] else -1
                confidence = 0.6
                regime = "elevated"
        
        # Volatility breakdown
        elif atr_ratio < 0.5:
            signal_strength = -0.2
            direction = 0
            confidence = 0.4
            regime = "low_vol"
        
        self.last_signal = AgentSignal(
            name=self.name,
            signal_strength=signal_strength,
            direction=direction,
            confidence=confidence,
            regime=regime,
            metadata={
                'atr_ratio': round(atr_ratio, 2),
                'bb_squeeze': round(bb_squeeze, 2),
                'vol_trend': round(vol_trend, 2)
            }
        )
        
        return self.last_signal
    
    def update(self, new_data: dict) -> None:
        if 'atr' in new_data:
            self.volatility_history.append(new_data['atr'])
            if len(self.volatility_history) > 100:
                self.volatility_history.pop(0)
    
    def _neutral_signal(self) -> AgentSignal:
        return AgentSignal(
            name=self.name,
            signal_strength=0,
            direction=0,
            confidence=0,
            regime="unknown"
        )

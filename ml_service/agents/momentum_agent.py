"""
Momentum Agent
Analyzes momentum buildup and acceleration patterns.

Key signals:
- Momentum buildup (pre-breakout)
- Momentum exhaustion
- Acceleration/deceleration
- Momentum divergence
"""
import numpy as np
import pandas as pd
from typing import Optional
import structlog

from .base_agent import BaseAgent, AgentSignal, AgentConfig

logger = structlog.get_logger()


class MomentumAgent(BaseAgent):
    """
    Momentum Intelligence Agent.
    
    Specializes in:
    - Energy buildup detection
    - Acceleration patterns
    - Momentum exhaustion
    - RSI/MACD analysis
    """
    
    def __init__(self, config: Optional[AgentConfig] = None):
        super().__init__(name="momentum")
        self.config = config or AgentConfig()
    
    def train(self, df: pd.DataFrame) -> None:
        self.is_trained = True
        logger.info("momentum_agent_trained")
    
    def analyze(self, df: pd.DataFrame) -> AgentSignal:
        """Analyze momentum patterns."""
        if df.empty:
            return self._neutral_signal()
        
        df = df.tail(50).copy()
        
        # Momentum calculations
        if 'momentum_5' not in df.columns:
            df['momentum_5'] = df['close'] - df['close'].shift(5)
        if 'momentum_10' not in df.columns:
            df['momentum_10'] = df['close'] - df['close'].shift(10)
        
        current_mom = df['momentum_5'].iloc[-1]
        prev_mom = df['momentum_5'].iloc[-2] if len(df) > 1 else current_mom
        
        # Acceleration (change in momentum)
        acceleration = current_mom - prev_mom
        
        # ROC
        if 'roc_5' in df.columns:
            roc = df['roc_5'].iloc[-1]
        else:
            roc = (df['close'].iloc[-1] / df['close'].iloc[-5] - 1) * 100 if len(df) >= 5 else 0
        
        # RSI analysis
        rsi = df['rsi_14'].iloc[-1] if 'rsi_14' in df.columns else 50
        
        # MACD histogram
        macd_hist = df['macd_hist'].iloc[-1] if 'macd_hist' in df.columns else 0
        prev_macd = df['macd_hist'].iloc[-2] if 'macd_hist' in df.columns and len(df) > 1 else 0
        macd_accelerating = macd_hist > prev_macd
        
        # Signals
        signal_strength = 0.0
        direction = 0
        confidence = 0.5
        regime = "neutral"
        
        # Strong momentum buildup
        if abs(roc) > 1 and acceleration > 0 and current_mom > 0:
            signal_strength = min(0.8, roc / 3)
            direction = 1
            confidence = 0.7
            regime = "building"
        elif abs(roc) > 1 and acceleration > 0 and current_mom < 0:
            signal_strength = max(-0.8, roc / 3)
            direction = -1
            confidence = 0.7
            regime = "building"
        
        # Momentum exhaustion
        elif (rsi > 70 and acceleration < 0) or (rsi < 30 and acceleration > 0):
            signal_strength = -0.4 if rsi > 70 else 0.4
            direction = -1 if rsi > 70 else 1
            confidence = 0.65
            regime = "exhaustion"
        
        # Acceleration without overextension
        elif abs(acceleration) > self.config.acceleration_threshold:
            signal_strength = np.sign(acceleration) * 0.5
            direction = int(np.sign(acceleration))
            confidence = 0.6
            regime = "accelerating"
        
        # MACD confirmation
        if macd_accelerating and np.sign(macd_hist) == direction:
            confidence = min(0.9, confidence + 0.15)
        
        self.last_signal = AgentSignal(
            name=self.name,
            signal_strength=signal_strength,
            direction=direction,
            confidence=confidence,
            regime=regime,
            metadata={
                'roc': round(roc, 2),
                'acceleration': round(acceleration, 4),
                'rsi': round(rsi, 1),
                'macd_accelerating': macd_accelerating
            }
        )
        
        return self.last_signal
    
    def update(self, new_data: dict) -> None:
        pass
    
    def _neutral_signal(self) -> AgentSignal:
        return AgentSignal(
            name=self.name,
            signal_strength=0,
            direction=0,
            confidence=0,
            regime="unknown"
        )

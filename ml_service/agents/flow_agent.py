"""
Flow Agent
Analyzes order flow and tick imbalance.

Key signals:
- Buy/sell pressure
- Order flow imbalance
- Absorption detection
- Liquidity gaps
"""
import numpy as np
import pandas as pd
from typing import Optional
import structlog

from .base_agent import BaseAgent, AgentSignal, AgentConfig

logger = structlog.get_logger()


class FlowAgent(BaseAgent):
    """
    Order Flow Intelligence Agent.
    
    Specializes in:
    - Tick imbalance
    - Volume-weighted direction
    - Buy/sell pressure estimation
    - Delta analysis
    """
    
    def __init__(self, config: Optional[AgentConfig] = None):
        super().__init__(name="flow")
        self.config = config or AgentConfig()
    
    def train(self, df: pd.DataFrame) -> None:
        self.is_trained = True
        logger.info("flow_agent_trained")
    
    def analyze(self, df: pd.DataFrame) -> AgentSignal:
        """Analyze order flow."""
        if df.empty:
            return self._neutral_signal()
        
        df = df.tail(30).copy()
        
        # Tick imbalance
        tick_imbalance = 0
        if 'tick_imbalance' in df.columns:
            tick_imbalance = df['tick_imbalance'].iloc[-1]
        else:
            # Estimate from price changes
            price_dirs = np.sign(df['close'].diff())
            tick_imbalance = price_dirs.tail(10).mean()
        
        # Volume imbalance
        volume_imbalance = 0
        if 'volume_imbalance' in df.columns:
            volume_imbalance = df['volume_imbalance'].iloc[-1]
        
        # Buy ratio (close position within bar)
        if 'estimated_buy_ratio' in df.columns:
            buy_ratio = df['estimated_buy_ratio'].iloc[-1]
        else:
            if df['high'].iloc[-1] != df['low'].iloc[-1]:
                buy_ratio = (df['close'].iloc[-1] - df['low'].iloc[-1]) / (df['high'].iloc[-1] - df['low'].iloc[-1])
            else:
                buy_ratio = 0.5
        
        # Cumulative delta trend
        delta_trend = 0
        if 'delta_ma' in df.columns:
            delta_trend = df['delta_ma'].iloc[-1]
        
        # Combined imbalance
        combined_imbalance = (tick_imbalance + volume_imbalance) / 2
        
        # Signals
        signal_strength = 0.0
        direction = 0
        confidence = 0.5
        regime = "balanced"
        
        # Strong buy pressure
        if combined_imbalance > self.config.imbalance_threshold and buy_ratio > 0.6:
            signal_strength = min(0.8, combined_imbalance * 2)
            direction = 1
            confidence = min(0.85, 0.5 + abs(combined_imbalance))
            regime = "buying"
        
        # Strong sell pressure
        elif combined_imbalance < -self.config.imbalance_threshold and buy_ratio < 0.4:
            signal_strength = max(-0.8, combined_imbalance * 2)
            direction = -1
            confidence = min(0.85, 0.5 + abs(combined_imbalance))
            regime = "selling"
        
        # Absorption (volume absorbed without price movement)
        elif abs(combined_imbalance) > 0.2 and abs(df['close'].iloc[-1] - df['close'].iloc[-5]) < df['atr_14'].iloc[-1] * 0.3 if 'atr_14' in df.columns else True:
            # High imbalance but no move = absorption
            signal_strength = combined_imbalance * 0.5  # Potential reversal
            direction = int(np.sign(combined_imbalance))
            confidence = 0.7
            regime = "absorption"
        
        self.last_signal = AgentSignal(
            name=self.name,
            signal_strength=signal_strength,
            direction=direction,
            confidence=confidence,
            regime=regime,
            metadata={
                'tick_imbalance': round(tick_imbalance, 2),
                'volume_imbalance': round(volume_imbalance, 2),
                'buy_ratio': round(buy_ratio, 2),
                'delta_trend': round(delta_trend, 4)
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

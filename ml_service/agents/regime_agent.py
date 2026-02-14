"""
Regime Agent
Wrapper around regime detection for the agent system.
"""
import numpy as np
import pandas as pd
from typing import Optional
import structlog

from .base_agent import BaseAgent, AgentSignal, AgentConfig
from deep_models.regime_model import RegimeDetector

logger = structlog.get_logger()


class RegimeAgent(BaseAgent):
    """
    Market Regime Intelligence Agent.
    
    Uses unsupervised regime detection to identify market states.
    """
    
    REGIME_SIGNALS = {
        'accumulation': 0.4,
        'manipulation': 0.0,
        'expansion': 0.7,
        'distribution': -0.4,
        'chop': 0.0,
        'trend': 0.5,
        'mean_reversion': -0.3,
        'breakout': 0.8
    }
    
    def __init__(self, config: Optional[AgentConfig] = None):
        super().__init__(name="regime")
        self.config = config or AgentConfig()
        self.detector = RegimeDetector()
    
    def train(self, df: pd.DataFrame) -> None:
        """Train regime detector."""
        try:
            self.detector.fit(df)
            self.is_trained = True
            logger.info("regime_agent_trained")
        except Exception as e:
            logger.warning("regime_training_failed", error=str(e))
    
    def analyze(self, df: pd.DataFrame) -> AgentSignal:
        """Detect current regime."""
        if df.empty or not self.detector.fitted:
            return self._neutral_signal()
        
        try:
            labels, probs = self.detector.predict(df)
            
            current_regime_idx = labels[-1]
            current_probs = probs[-1]
            
            regime_name = self.detector.REGIME_NAMES[current_regime_idx % len(self.detector.REGIME_NAMES)]
            confidence = float(current_probs.max())
            
            # Get signal based on regime
            base_signal = self.REGIME_SIGNALS.get(regime_name, 0)
            
            # Adjust signal by confidence
            signal_strength = base_signal * confidence
            
            # Direction based on regime
            if regime_name in ['accumulation', 'expansion', 'trend', 'breakout']:
                direction = 1
            elif regime_name in ['distribution', 'mean_reversion']:
                direction = -1
            else:
                direction = 0
            
            self.last_signal = AgentSignal(
                name=self.name,
                signal_strength=signal_strength,
                direction=direction,
                confidence=confidence,
                regime=regime_name,
                metadata={
                    'regime_probs': {n: round(p, 3) for n, p in zip(self.detector.REGIME_NAMES, current_probs)}
                }
            )
            
            return self.last_signal
            
        except Exception as e:
            logger.warning("regime_analysis_failed", error=str(e))
            return self._neutral_signal()
    
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

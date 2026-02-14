"""
Ensemble Decision Engine
Combines signals from multiple agents using weighted fusion.

Implements:
- Dynamic weighting based on agent confidence
- Regime-based weight adjustment
- Disagreement filtering
- Confidence gating
"""
import numpy as np
import pandas as pd
from typing import List, Dict, Optional
from dataclasses import dataclass
import structlog

from agents.base_agent import BaseAgent, AgentSignal

logger = structlog.get_logger()


@dataclass
class FusedSignal:
    """Final fused signal from ensemble."""
    signal_strength: float       # -1 to 1
    direction: int               # -1, 0, 1
    confidence: float            # 0 to 1
    regime: str
    
    # Breakdown
    agent_signals: Dict[str, AgentSignal]
    agreement_score: float       # How much agents agree
    weighted_contributions: Dict[str, float]
    
    # Decision
    action: str                  # 'strong_buy', 'buy', 'hold', 'sell', 'strong_sell'
    
    def to_dict(self) -> dict:
        return {
            'signal_strength': self.signal_strength,
            'direction': self.direction,
            'confidence': self.confidence,
            'regime': self.regime,
            'action': self.action,
            'agreement_score': self.agreement_score,
            'agent_signals': {k: v.to_dict() for k, v in self.agent_signals.items()},
            'weighted_contributions': self.weighted_contributions
        }


class EnsembleEngine:
    """
    Multi-agent signal fusion engine.
    
    Combines:
    - Volume Agent
    - Volatility Agent
    - Momentum Agent
    - Flow Agent
    - Regime Agent
    
    Using:
    - Confidence-weighted averaging
    - Regime-adaptive weights
    - Disagreement filtering
    """
    
    # Base weights (can be learned)
    # Base weights (can be learned)
    DEFAULT_WEIGHTS = {
        # Heuristic Agents (50%)
        'volume': 0.10,
        'volatility': 0.10,
        'momentum': 0.10,
        'flow': 0.10,
        'regime': 0.10,
        
        # Deep Models (50%)
        'lstm': 0.25,
        'xgboost': 0.15,
        'lightgbm': 0.15
    }
    
    # Regime-specific weight adjustments
    REGIME_WEIGHT_MODS = {
        'accumulation': {'volume': 1.3, 'flow': 1.2, 'momentum': 0.8},
        'expansion': {'momentum': 1.4, 'volatility': 1.2, 'flow': 1.1},
        'distribution': {'volume': 1.3, 'flow': 1.2, 'momentum': 0.9},
        'breakout': {'momentum': 1.3, 'volatility': 1.3, 'volume': 1.2},
        'chop': {'regime': 0.5, 'momentum': 0.7},  # Reduce all during chop
        'compression': {'volatility': 1.5, 'volume': 1.2}
    }
    
    def __init__(self, agents: List[BaseAgent], weights: Optional[Dict[str, float]] = None):
        self.agents = {agent.name: agent for agent in agents}
        self.weights = weights or self.DEFAULT_WEIGHTS.copy()
        
        # Ensure all agents have weights
        for name in self.agents:
            if name not in self.weights:
                self.weights[name] = 0.1
        
        # Normalize weights
        total = sum(self.weights.values())
        self.weights = {k: v/total for k, v in self.weights.items()}
    
    def fuse_signals(
        self, 
        df: pd.DataFrame,
        deep_signals: Optional[Dict[str, float]] = None,
        min_confidence: float = 0.5,
        min_agreement: float = 0.3
    ) -> FusedSignal:
        """
        Fuse all agent signals into final decision.
        
        Args:
            df: Market data
            deep_signals: Dict of {model_name: probability}
            min_confidence: Minimum confidence to act
            min_agreement: Minimum agent agreement
            
        Returns:
            FusedSignal with combined decision
        """
        # Collect signals from all agents
        signals: Dict[str, AgentSignal] = {}
        for name, agent in self.agents.items():
            try:
                signal = agent.analyze(df)
                signals[name] = signal
            except Exception as e:
                logger.warning(f"agent_failed", agent=name, error=str(e))
        
        # Add deep models as pseudo-agent signals
        if deep_signals:
            for name, prob in deep_signals.items():
                # Convert prob (0-1) to signal (-1 to 1)
                # Prob > 0.5 is Buy, < 0.5 is Sell (assuming binary 'profitable move' label)
                # Note: Labels in deep_train are 1=Profitable, 0=Not.
                # But 'Not Profitable' doesn't mean 'Sell', it means 'Ignore'.
                # However, for simplicity in this binary system:
                # If we treat 0 as 'Down/No Move', then <0.5 is bearish/neutral.
                # Let's map: 0.5 -> 0, 1.0 -> 1.0, 0.0 -> -1.0
                strength = (prob - 0.5) * 2
                
                # Confidence is magnitude of strength
                conf = abs(strength)
                
                # Direction
                direction = 1 if strength > 0.1 else (-1 if strength < -0.1 else 0)
                
                signals[name] = AgentSignal(
                    name=name,
                    signal_strength=strength,
                    direction=direction,
                    confidence=conf,
                    regime="deep_learning"
                )
        
        if not signals:
            return self._neutral_fused_signal()
        
        # Get current regime from regime agent
        current_regime = "unknown"
        if 'regime' in signals:
            current_regime = signals['regime'].regime or "unknown"
        
        # Adjust weights based on regime
        adjusted_weights = self._adjust_weights_for_regime(current_regime)
        
        # Calculate weighted signal
        weighted_signal = 0.0
        weighted_direction = 0.0
        weighted_confidence = 0.0
        total_weight = 0.0
        contributions: Dict[str, float] = {}
        
        for name, signal in signals.items():
            if name not in adjusted_weights:
                continue
            
            weight = adjusted_weights[name]
            
            # Weight by agent confidence
            effective_weight = weight * signal.confidence
            total_weight += effective_weight
            
            contribution = signal.signal_strength * effective_weight
            weighted_signal += contribution
            weighted_direction += signal.direction * effective_weight
            weighted_confidence += signal.confidence * weight
            
            contributions[name] = round(contribution, 3)
        
        # Normalize
        if total_weight > 0:
            weighted_signal /= total_weight
            weighted_direction /= total_weight
        
        weighted_confidence = min(1.0, weighted_confidence)
        
        # Calculate agreement score
        directions = [s.direction for s in signals.values() if s.confidence > 0.4]
        if directions:
            agreement = abs(sum(directions)) / len(directions)
        else:
            agreement = 0
        
        # Final direction
        final_direction = int(np.sign(weighted_direction)) if abs(weighted_direction) > 0.3 else 0
        
        # Confidence gating
        if agreement < min_agreement:
            weighted_confidence *= 0.5  # Reduce confidence on disagreement
        
        # Determine action
        action = self._determine_action(weighted_signal, weighted_confidence, final_direction)
        
        fused = FusedSignal(
            signal_strength=round(weighted_signal, 3),
            direction=final_direction,
            confidence=round(weighted_confidence, 3),
            regime=current_regime,
            agent_signals=signals,
            agreement_score=round(agreement, 2),
            weighted_contributions=contributions,
            action=action
        )
        
        logger.info("signals_fused",
                    action=action,
                    signal=round(weighted_signal, 3),
                    confidence=round(weighted_confidence, 3),
                    regime=current_regime)
        
        return fused
    
    def _adjust_weights_for_regime(self, regime: str) -> Dict[str, float]:
        """Adjust weights based on current regime."""
        adjusted = self.weights.copy()
        
        if regime in self.REGIME_WEIGHT_MODS:
            mods = self.REGIME_WEIGHT_MODS[regime]
            for agent, modifier in mods.items():
                if agent in adjusted:
                    adjusted[agent] *= modifier
        
        # Renormalize
        total = sum(adjusted.values())
        if total > 0:
            adjusted = {k: v/total for k, v in adjusted.items()}
        
        return adjusted
    
    def _determine_action(self, signal: float, confidence: float, direction: int) -> str:
        """Determine trading action from signal."""
        if confidence < 0.4:
            return 'hold'
        
        if signal > 0.6 and direction > 0:
            return 'strong_buy'
        elif signal > 0.3 and direction > 0:
            return 'buy'
        elif signal < -0.6 and direction < 0:
            return 'strong_sell'
        elif signal < -0.3 and direction < 0:
            return 'sell'
        else:
            return 'hold'
    
    def _neutral_fused_signal(self) -> FusedSignal:
        return FusedSignal(
            signal_strength=0,
            direction=0,
            confidence=0,
            regime="unknown",
            agent_signals={},
            agreement_score=0,
            weighted_contributions={},
            action='hold'
        )
    
    def train_all_agents(self, df: pd.DataFrame) -> None:
        """Train all agents on historical data."""
        for name, agent in self.agents.items():
            try:
                agent.train(df)
            except Exception as e:
                logger.warning(f"agent_train_failed", agent=name, error=str(e))


class ConfidenceEngine:
    """
    Confidence calibration and adjustment.
    
    Ensures model confidence aligns with actual accuracy.
    """
    
    def __init__(self):
        self.calibration_curve = None
        self.accuracy_bins = {}
    
    def calibrate(self, predictions: np.ndarray, actuals: np.ndarray, n_bins: int = 10):
        """
        Calibrate confidence using historical predictions.
        
        Creates mapping from model confidence to empirical accuracy.
        """
        bins = np.linspace(0, 1, n_bins + 1)
        
        for i in range(n_bins):
            low, high = bins[i], bins[i+1]
            mask = (predictions >= low) & (predictions < high)
            
            if mask.sum() > 0:
                empirical_accuracy = actuals[mask].mean()
                self.accuracy_bins[(low, high)] = empirical_accuracy
    
    def adjust_confidence(self, raw_confidence: float) -> float:
        """Adjust raw confidence using calibration."""
        if not self.accuracy_bins:
            return raw_confidence
        
        for (low, high), accuracy in self.accuracy_bins.items():
            if low <= raw_confidence < high:
                # Blend raw with empirical
                return 0.5 * raw_confidence + 0.5 * accuracy
        
        return raw_confidence

"""
Confidence Gate
Filters signals based on confidence thresholds.

Only allows high-confidence signals to pass through to execution.
"""
from dataclasses import dataclass
from typing import Optional
import structlog

from fusion.ensemble import FusedSignal

logger = structlog.get_logger()


@dataclass
class GateConfig:
    """Confidence gating configuration."""
    min_confidence: float = 0.55        # Minimum confidence to pass
    min_agreement: float = 0.4          # Minimum agent agreement
    min_signal_strength: float = 0.25   # Minimum absolute signal strength
    
    # Regime-specific thresholds
    regime_thresholds: dict = None
    
    def __post_init__(self):
        if self.regime_thresholds is None:
            self.regime_thresholds = {
                'accumulation': 0.50,    # Lower threshold for accumulation
                'expansion': 0.50,       # Lower for expansion (trend following)
                'breakout': 0.55,
                'chop': 0.75,            # Higher threshold for choppy markets
                'distribution': 0.60,
                'manipulation': 0.80,    # Very high for manipulation
                'mean_reversion': 0.60,
                'trend': 0.50
            }


class ConfidenceGate:
    """
    Gates signals based on confidence and quality thresholds.
    
    Prevents low-quality signals from reaching execution.
    """
    
    def __init__(self, config: Optional[GateConfig] = None):
        self.config = config or GateConfig()
        
        # Stats
        self.total_received = 0
        self.total_passed = 0
        self.total_blocked = 0
        self.block_reasons = {}
    
    def gate(self, signal: FusedSignal) -> tuple[bool, str]:
        """
        Check if signal passes confidence gate.
        
        Returns:
            (passed: bool, reason: str)
        """
        self.total_received += 1
        
        # Get regime-specific threshold
        regime = signal.regime or 'unknown'
        threshold = self.config.regime_thresholds.get(
            regime, 
            self.config.min_confidence
        )
        
        # Check confidence
        if signal.confidence < threshold:
            return self._block("low_confidence", 
                f"confidence {signal.confidence:.2f} < threshold {threshold:.2f}")
        
        # Check agreement
        if signal.agreement_score < self.config.min_agreement:
            return self._block("low_agreement",
                f"agreement {signal.agreement_score:.2f} < {self.config.min_agreement:.2f}")
        
        # Check signal strength
        if abs(signal.signal_strength) < self.config.min_signal_strength:
            return self._block("weak_signal",
                f"strength {abs(signal.signal_strength):.2f} < {self.config.min_signal_strength:.2f}")
        
        # Passed
        self.total_passed += 1
        return True, "passed"
    
    def _block(self, reason: str, detail: str) -> tuple[bool, str]:
        """Record blocked signal."""
        self.total_blocked += 1
        self.block_reasons[reason] = self.block_reasons.get(reason, 0) + 1
        logger.debug("signal_gated", reason=reason, detail=detail)
        return False, reason
    
    def get_stats(self) -> dict:
        """Get gating statistics."""
        return {
            'total_received': self.total_received,
            'total_passed': self.total_passed,
            'total_blocked': self.total_blocked,
            'pass_rate': self.total_passed / max(1, self.total_received),
            'block_reasons': self.block_reasons
        }
    
    def reset_stats(self):
        """Reset statistics."""
        self.total_received = 0
        self.total_passed = 0
        self.total_blocked = 0
        self.block_reasons = {}


# Global instance
confidence_gate = ConfidenceGate()

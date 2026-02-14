"""
Decision Engine (Phase 7 Enhanced)
Final decision logic with risk management and profit-based sizing.

Phase 7 Enhancements:
- Edge-based position sizing (proven profitability)
- Regime strategy integration (trade permissions)
- Signal tracking hooks (for learning loop)
- Kelly multiplier by historical edge

Converts signals to actionable trading decisions with:
- Profit-based sizing
- Risk limits
- Regime filtering
- Signal validation
"""
import numpy as np
from typing import Optional, Dict, List
from dataclasses import dataclass
from datetime import datetime
import structlog

from fusion.ensemble import FusedSignal

# Phase 7 imports
try:
    from profit_validator import profit_validator, get_sizing_multiplier
    from regime_strategy import regime_strategy, should_trade, adjust_size_for_regime
    from signal_tracker import signal_tracker, record_from_fused_signal
    PHASE7_ENABLED = True
except ImportError:
    PHASE7_ENABLED = False

logger = structlog.get_logger()


@dataclass
class TradeDecision:
    """Actionable trading decision."""
    symbol: str
    timestamp: datetime
    
    # Signal
    action: str                  # 'long', 'short', 'close', 'hold'
    signal_strength: float
    confidence: float
    
    # Sizing
    position_size_pct: float     # % of capital
    risk_pct: float              # Risk as % of capital
    
    # Levels
    entry_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    
    # Context
    regime: str = "unknown"
    reason: str = ""
    
    def to_dict(self) -> dict:
        return {
            'symbol': self.symbol,
            'timestamp': self.timestamp.isoformat(),
            'action': self.action,
            'signal_strength': self.signal_strength,
            'confidence': self.confidence,
            'position_size_pct': self.position_size_pct,
            'risk_pct': self.risk_pct,
            'entry_price': self.entry_price,
            'stop_loss': self.stop_loss,
            'take_profit': self.take_profit,
            'regime': self.regime,
            'reason': self.reason
        }


@dataclass
class RiskConfig:
    """Risk management configuration."""
    max_position_pct: float = 10.0      # Max single position
    max_total_risk_pct: float = 2.0     # Max risk per trade
    max_drawdown_pct: float = 10.0      # Max portfolio drawdown
    
    min_confidence: float = 0.55        # Minimum confidence to trade
    min_signal_strength: float = 0.3    # Minimum signal strength
    min_agreement: float = 0.4          # Minimum agent agreement
    
    # ATR-based stops
    stop_atr_multiplier: float = 2.0
    target_atr_multiplier: float = 3.0
    
    # Regime filters
    avoid_regimes: List[str] = None
    
    def __post_init__(self):
        if self.avoid_regimes is None:
            self.avoid_regimes = ['chop', 'manipulation']


class DecisionEngine:
    """
    Converts fused signals to trading decisions.
    
    Phase 7 Enhanced with:
    - Edge-based position sizing
    - Regime strategy integration
    - Signal tracking for learning loop
    - Profit-validated Kelly sizing
    """
    
    def __init__(self, config: Optional[RiskConfig] = None):
        self.config = config or RiskConfig()
        
        # Track recent decisions
        self.recent_decisions: List[TradeDecision] = []
        self.current_exposure = 0.0
        
        # Phase 7 stats
        self.phase7_stats = {
            'edge_adjusted_trades': 0,
            'regime_blocked_trades': 0,
            'signals_tracked': 0
        }
        
        logger.info("decision_engine_initialized", phase7=PHASE7_ENABLED)
    
    def make_decision(
        self,
        signal: FusedSignal,
        symbol: str,
        current_price: float,
        atr: float = 0,
        current_position: float = 0  # Current position (positive = long)
    ) -> TradeDecision:
        """
        Make trading decision from fused signal.
        
        Phase 7: Uses historical edge for sizing, regime for permissions.
        """
        timestamp = datetime.now()
        
        # ===== PHASE 7: Regime Strategy Check =====
        if PHASE7_ENABLED:
            allowed, reason = should_trade(signal.regime, signal.confidence)
            if not allowed:
                self.phase7_stats['regime_blocked_trades'] += 1
                return self._hold_decision(symbol, timestamp, signal, f"regime:{reason}")
        else:
            # Fallback to config-based filtering
            if signal.regime in self.config.avoid_regimes:
                return self._hold_decision(symbol, timestamp, signal, "regime_filtered")
        
        # Check minimum thresholds
        if signal.confidence < self.config.min_confidence:
            return self._hold_decision(symbol, timestamp, signal, "low_confidence")
        
        if abs(signal.signal_strength) < self.config.min_signal_strength:
            return self._hold_decision(symbol, timestamp, signal, "weak_signal")
        
        if signal.agreement_score < self.config.min_agreement:
            return self._hold_decision(symbol, timestamp, signal, "disagreement")
        
        # Determine action
        if signal.action in ['strong_buy', 'buy']:
            action = 'long'
        elif signal.action in ['strong_sell', 'sell']:
            action = 'short'
        else:
            return self._hold_decision(symbol, timestamp, signal, "neutral_signal")
        
        # Check existing position
        if current_position != 0:
            # Already positioned
            if (current_position > 0 and action == 'long') or (current_position < 0 and action == 'short'):
                return self._hold_decision(symbol, timestamp, signal, "already_positioned")
            else:
                # Opposite signal - close position
                action = 'close'
        
        # ===== PHASE 7: Edge-Based Position Sizing =====
        if PHASE7_ENABLED:
            # Get historical edge for this signal type
            historical_edge = profit_validator.get_signal_edge(signal.action)
            edge_multiplier = get_sizing_multiplier(signal.action)
            
            # Base Kelly calculation
            win_rate = profit_validator.get_win_rate(signal.action)
            if win_rate < 0.5:
                win_rate = 0.5 + (signal.confidence - 0.5) * 0.3  # Blend
        else:
            historical_edge = abs(signal.signal_strength)
            edge_multiplier = 1.0
            win_rate = 0.5 + (signal.confidence - 0.5) * 0.5
        
        edge = abs(signal.signal_strength)
        
        # Kelly fraction (conservative: half-Kelly)
        if win_rate > 0.5:
            kelly_fraction = (win_rate * edge - (1 - win_rate)) / edge
            kelly_fraction = max(0, min(kelly_fraction, 0.25))  # Cap at 25%
            kelly_fraction *= 0.5  # Half-Kelly
        else:
            kelly_fraction = 0.05  # Minimum
        
        # Apply edge multiplier from profit validation
        kelly_fraction *= edge_multiplier
        
        # Apply regime-based adjustment
        if PHASE7_ENABLED:
            position_size = adjust_size_for_regime(kelly_fraction * 100, signal.regime)
            self.phase7_stats['edge_adjusted_trades'] += 1
        else:
            position_size = min(kelly_fraction * 100, self.config.max_position_pct)
        
        # Calculate stops
        stop_loss = None
        take_profit = None
        risk_pct = 0
        
        if atr > 0:
            if action == 'long':
                stop_loss = current_price - (atr * self.config.stop_atr_multiplier)
                take_profit = current_price + (atr * self.config.target_atr_multiplier)
            elif action == 'short':
                stop_loss = current_price + (atr * self.config.stop_atr_multiplier)
                take_profit = current_price - (atr * self.config.target_atr_multiplier)
            
            # Calculate risk
            if stop_loss:
                risk_pct = abs(current_price - stop_loss) / current_price * position_size
                
                # Reduce size if risk too high
                if risk_pct > self.config.max_total_risk_pct:
                    position_size *= self.config.max_total_risk_pct / risk_pct
                    risk_pct = self.config.max_total_risk_pct
        
        # Build decision
        decision = TradeDecision(
            symbol=symbol,
            timestamp=timestamp,
            action=action,
            signal_strength=signal.signal_strength,
            confidence=signal.confidence,
            position_size_pct=round(position_size, 2),
            risk_pct=round(risk_pct, 2),
            entry_price=current_price,
            stop_loss=round(stop_loss, 2) if stop_loss else None,
            take_profit=round(take_profit, 2) if take_profit else None,
            regime=signal.regime,
            reason=f"signal_{signal.action}"
        )
        
        # Track
        self.recent_decisions.append(decision)
        if len(self.recent_decisions) > 100:
            self.recent_decisions.pop(0)
        
        logger.info("decision_made",
                    symbol=symbol,
                    action=action,
                    size=position_size,
                    confidence=signal.confidence)
        
        return decision
    
    def _hold_decision(
        self, 
        symbol: str, 
        timestamp: datetime, 
        signal: FusedSignal,
        reason: str
    ) -> TradeDecision:
        """Generate hold decision."""
        return TradeDecision(
            symbol=symbol,
            timestamp=timestamp,
            action='hold',
            signal_strength=signal.signal_strength,
            confidence=signal.confidence,
            position_size_pct=0,
            risk_pct=0,
            regime=signal.regime,
            reason=reason
        )
    
    def get_recent_decisions(self, n: int = 10) -> List[dict]:
        """Get recent decisions."""
        return [d.to_dict() for d in self.recent_decisions[-n:]]

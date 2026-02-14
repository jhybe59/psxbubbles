"""
Regime Strategy Layer
The CONTEXTUAL TRADING RULES of the system.

Enforces when and how to trade based on market state.
Even the best signal is useless in the wrong regime.

Features:
- Regime-based trade permissions
- Strategy selection per regime
- Position limits by market state
- Transition detection
"""
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum
import structlog

logger = structlog.get_logger()


class Regime(str, Enum):
    """Market regime classifications."""
    COMPRESSION = "compression"   # Low volatility, building pressure
    BREAKOUT = "breakout"         # High volatility expansion
    TRENDING = "trending"         # Directional movement
    CHOP = "chop"                 # Range-bound, noisy
    PANIC = "panic"               # Extreme volatility, risk-off
    ACCUMULATION = "accumulation" # Smart money building
    DISTRIBUTION = "distribution" # Smart money selling
    UNKNOWN = "unknown"


class TradePermission(str, Enum):
    """Trade permission levels."""
    AGGRESSIVE = "aggressive"     # Full position, momentum plays
    NORMAL = "normal"             # Standard position
    SCALP_ONLY = "scalp_only"     # Small, quick trades only
    PREPARE_ONLY = "prepare_only" # Watch, no trades
    RISK_OFF = "risk_off"         # No trades allowed


class Strategy(str, Enum):
    """Trading strategy types."""
    MOMENTUM = "momentum"         # Trend following
    SWING = "swing"               # Position trading
    SCALPING = "scalping"         # Quick in-out
    MEAN_REVERSION = "mean_reversion"
    NONE = "none"                 # No trading


@dataclass
class RegimeRules:
    """Trading rules for a specific regime."""
    regime: str
    permission: TradePermission
    max_position_pct: float       # Max position as % of capital
    strategy: Strategy
    min_confidence: float         # Minimum signal confidence to trade
    kelly_multiplier: float       # Sizing multiplier
    alert_message: str = ""
    
    def to_dict(self) -> dict:
        return {
            'regime': self.regime,
            'permission': self.permission.value,
            'max_position_pct': self.max_position_pct,
            'strategy': self.strategy.value,
            'min_confidence': self.min_confidence,
            'kelly_multiplier': self.kelly_multiplier,
            'alert_message': self.alert_message
        }


# ==================== REGIME RULES DEFINITION ====================

REGIME_RULES: Dict[str, RegimeRules] = {
    
    Regime.COMPRESSION.value: RegimeRules(
        regime=Regime.COMPRESSION.value,
        permission=TradePermission.PREPARE_ONLY,
        max_position_pct=0.0,
        strategy=Strategy.NONE,
        min_confidence=0.9,       # Almost never trade
        kelly_multiplier=0.0,
        alert_message="🔄 Compression regime - Watch for breakout"
    ),
    
    Regime.BREAKOUT.value: RegimeRules(
        regime=Regime.BREAKOUT.value,
        permission=TradePermission.AGGRESSIVE,
        max_position_pct=10.0,
        strategy=Strategy.MOMENTUM,
        min_confidence=0.55,      # Lower threshold, act fast
        kelly_multiplier=1.5,
        alert_message="🚀 Breakout detected - Momentum mode active"
    ),
    
    Regime.TRENDING.value: RegimeRules(
        regime=Regime.TRENDING.value,
        permission=TradePermission.NORMAL,
        max_position_pct=8.0,
        strategy=Strategy.SWING,
        min_confidence=0.6,
        kelly_multiplier=1.2,
        alert_message="📈 Trending market - Swing trades enabled"
    ),
    
    Regime.CHOP.value: RegimeRules(
        regime=Regime.CHOP.value,
        permission=TradePermission.SCALP_ONLY,
        max_position_pct=3.0,
        strategy=Strategy.MEAN_REVERSION,
        min_confidence=0.75,      # Higher bar in choppy markets
        kelly_multiplier=0.5,
        alert_message="⚡ Choppy market - Scalping only, mean-reversion"
    ),
    
    Regime.PANIC.value: RegimeRules(
        regime=Regime.PANIC.value,
        permission=TradePermission.RISK_OFF,
        max_position_pct=0.0,
        strategy=Strategy.NONE,
        min_confidence=1.0,       # Never trade
        kelly_multiplier=0.0,
        alert_message="🛑 PANIC - Risk off, no trades allowed"
    ),
    
    Regime.ACCUMULATION.value: RegimeRules(
        regime=Regime.ACCUMULATION.value,
        permission=TradePermission.NORMAL,
        max_position_pct=7.0,
        strategy=Strategy.SWING,
        min_confidence=0.65,
        kelly_multiplier=1.0,
        alert_message="💰 Accumulation - Smart money buying"
    ),
    
    Regime.DISTRIBUTION.value: RegimeRules(
        regime=Regime.DISTRIBUTION.value,
        permission=TradePermission.NORMAL,
        max_position_pct=5.0,
        strategy=Strategy.SWING,
        min_confidence=0.7,
        kelly_multiplier=0.8,
        alert_message="📉 Distribution - Smart money selling"
    ),
    
    Regime.UNKNOWN.value: RegimeRules(
        regime=Regime.UNKNOWN.value,
        permission=TradePermission.SCALP_ONLY,
        max_position_pct=2.0,
        strategy=Strategy.SCALPING,
        min_confidence=0.8,
        kelly_multiplier=0.3,
        alert_message="❓ Unknown regime - Conservative mode"
    ),
}


# Default rules for any unlisted regime
DEFAULT_RULES = RegimeRules(
    regime="default",
    permission=TradePermission.SCALP_ONLY,
    max_position_pct=2.0,
    strategy=Strategy.SCALPING,
    min_confidence=0.75,
    kelly_multiplier=0.3,
    alert_message="⚠️ Undefined regime - Conservative"
)


class RegimeStrategy:
    """
    Enforces trading rules based on current market regime.
    
    This is the PERMISSION LAYER - even good signals
    get filtered if the regime is wrong.
    """
    
    def __init__(self, rules: Optional[Dict[str, RegimeRules]] = None):
        self.rules = rules or REGIME_RULES
        self.current_regime: str = Regime.UNKNOWN.value
        self.regime_history: list = []
        self.max_history = 100
        
        logger.info("regime_strategy_initialized",
                   regimes=list(self.rules.keys()))
    
    # ==================== REGIME MANAGEMENT ====================
    
    def set_regime(self, regime: str) -> RegimeRules:
        """
        Set current regime and return applicable rules.
        """
        old_regime = self.current_regime
        self.current_regime = regime
        
        # Track history
        if old_regime != regime:
            self.regime_history.append({
                'from': old_regime,
                'to': regime,
                'timestamp': __import__('datetime').datetime.now().isoformat()
            })
            if len(self.regime_history) > self.max_history:
                self.regime_history.pop(0)
            
            logger.info("regime_changed",
                       from_regime=old_regime,
                       to_regime=regime)
        
        return self.get_rules(regime)
    
    def get_rules(self, regime: Optional[str] = None) -> RegimeRules:
        """Get rules for a regime (or current if not specified)."""
        regime = regime or self.current_regime
        return self.rules.get(regime, DEFAULT_RULES)
    
    # ==================== TRADE PERMISSION ====================
    
    def is_trade_allowed(
        self, 
        regime: Optional[str] = None,
        signal_confidence: float = 0.0
    ) -> bool:
        """
        Check if trading is allowed in current/specified regime.
        
        Returns False for RISK_OFF or PREPARE_ONLY regimes.
        Also checks if confidence meets minimum threshold.
        """
        rules = self.get_rules(regime)
        
        # Permission check
        if rules.permission in [TradePermission.RISK_OFF, 
                                TradePermission.PREPARE_ONLY]:
            return False
        
        # Confidence check
        if signal_confidence < rules.min_confidence:
            return False
        
        return True
    
    def get_trade_permission(
        self, 
        regime: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get full trade permission details.
        
        Returns dict with:
        - allowed: bool
        - permission: str
        - max_position: float
        - strategy: str
        - kelly_mult: float
        - message: str
        """
        rules = self.get_rules(regime)
        
        allowed = rules.permission not in [
            TradePermission.RISK_OFF,
            TradePermission.PREPARE_ONLY
        ]
        
        return {
            'allowed': allowed,
            'permission': rules.permission.value,
            'max_position_pct': rules.max_position_pct,
            'strategy': rules.strategy.value,
            'min_confidence': rules.min_confidence,
            'kelly_multiplier': rules.kelly_multiplier,
            'message': rules.alert_message
        }
    
    def get_position_limit(self, regime: Optional[str] = None) -> float:
        """Get max position percentage for regime."""
        return self.get_rules(regime).max_position_pct
    
    def get_kelly_multiplier(self, regime: Optional[str] = None) -> float:
        """Get Kelly sizing multiplier for regime."""
        return self.get_rules(regime).kelly_multiplier
    
    def get_strategy(self, regime: Optional[str] = None) -> str:
        """Get recommended strategy for regime."""
        return self.get_rules(regime).strategy.value
    
    # ==================== REGIME DETECTION HELPERS ====================
    
    def detect_regime_from_volatility(
        self,
        current_volatility: float,
        avg_volatility: float,
        is_trending: bool = False
    ) -> str:
        """
        Simple rule-based regime detection from volatility.
        
        This can be enhanced with ML later.
        """
        vol_ratio = current_volatility / avg_volatility if avg_volatility > 0 else 1.0
        
        if vol_ratio > 3.0:
            return Regime.PANIC.value
        elif vol_ratio > 2.0:
            if is_trending:
                return Regime.BREAKOUT.value
            else:
                return Regime.CHOP.value
        elif vol_ratio > 1.2:
            if is_trending:
                return Regime.TRENDING.value
            else:
                return Regime.CHOP.value
        elif vol_ratio < 0.5:
            return Regime.COMPRESSION.value
        else:
            if is_trending:
                return Regime.TRENDING.value
            else:
                return Regime.UNKNOWN.value
    
    # ==================== REPORTING ====================
    
    def get_status(self) -> Dict[str, Any]:
        """Get current regime status for dashboard."""
        rules = self.get_rules()
        return {
            'current_regime': self.current_regime,
            'permission': rules.permission.value,
            'max_position': rules.max_position_pct,
            'strategy': rules.strategy.value,
            'alert': rules.alert_message,
            'history_length': len(self.regime_history)
        }
    
    def get_all_rules(self) -> Dict[str, dict]:
        """Get all regime rules for documentation/UI."""
        return {
            regime: rules.to_dict() 
            for regime, rules in self.rules.items()
        }


# Singleton instance
regime_strategy = RegimeStrategy()


# ==================== INTEGRATION HELPERS ====================

def should_trade(
    regime: str,
    signal_confidence: float
) -> tuple[bool, str]:
    """
    Quick check if trade should proceed.
    
    Returns: (allowed: bool, reason: str)
    """
    if not regime_strategy.is_trade_allowed(regime, signal_confidence):
        rules = regime_strategy.get_rules(regime)
        
        if rules.permission == TradePermission.RISK_OFF:
            return False, f"RISK_OFF: {rules.alert_message}"
        elif rules.permission == TradePermission.PREPARE_ONLY:
            return False, f"PREPARE_ONLY: {rules.alert_message}"
        else:
            return False, f"Low confidence ({signal_confidence:.0%} < {rules.min_confidence:.0%})"
    
    return True, "Trade allowed"


def adjust_size_for_regime(
    base_size: float,
    regime: str
) -> float:
    """
    Adjust position size based on regime rules.
    
    Returns adjusted size within regime limits.
    """
    rules = regime_strategy.get_rules(regime)
    
    # Apply Kelly multiplier
    adjusted = base_size * rules.kelly_multiplier
    
    # Cap at regime's max position
    return min(adjusted, rules.max_position_pct)

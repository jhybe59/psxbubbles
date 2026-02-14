"""
Risk Filter
Applies risk constraints before signal emission.

Filters:
- Maximum exposure per symbol
- Correlated exposure limits
- Volatility caps
- Drawdown protection
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Set
import numpy as np
import structlog

from fusion.decision_engine import TradeDecision

logger = structlog.get_logger()


@dataclass
class RiskLimits:
    """Risk limit configuration."""
    # Position limits
    max_position_per_symbol_pct: float = 15.0   # Max 15% in one symbol
    max_total_exposure_pct: float = 50.0         # Max 50% total exposure
    max_correlated_exposure_pct: float = 30.0    # Max 30% in correlated assets
    
    # Volatility limits
    max_volatility_multiplier: float = 3.0       # Max 3x normal volatility
    
    # Drawdown protection
    max_daily_loss_pct: float = 3.0              # Stop after 3% daily loss
    max_weekly_loss_pct: float = 7.0             # Stop after 7% weekly loss
    
    # Concentration
    max_sector_exposure_pct: float = 40.0        # Max in one sector
    max_positions: int = 10                      # Max simultaneous positions


@dataclass
class PositionState:
    """Current portfolio state."""
    positions: Dict[str, float] = field(default_factory=dict)  # symbol -> size
    daily_pnl: float = 0.0
    weekly_pnl: float = 0.0
    
    # Sector mapping (if available)
    symbol_sectors: Dict[str, str] = field(default_factory=dict)


class RiskFilter:
    """
    Filters signals based on risk constraints.
    """
    
    def __init__(
        self, 
        limits: Optional[RiskLimits] = None,
        state: Optional[PositionState] = None
    ):
        self.limits = limits or RiskLimits()
        self.state = state or PositionState()
        
        # Track volatility baselines
        self.volatility_baselines: Dict[str, float] = {}
        
        # Stats
        self.total_checked = 0
        self.total_blocked = 0
        self.block_reasons: Dict[str, int] = {}
    
    def check(
        self,
        decision: TradeDecision,
        current_volatility: float = 0
    ) -> tuple[bool, str]:
        """
        Check if decision passes risk filters.
        
        Returns:
            (passed: bool, reason: str)
        """
        self.total_checked += 1
        symbol = decision.symbol
        
        # Check max positions
        if len(self.state.positions) >= self.limits.max_positions:
            if symbol not in self.state.positions:
                return self._block("max_positions")
        
        # Check position size limit
        if decision.position_size_pct > self.limits.max_position_per_symbol_pct:
            return self._block("position_too_large")
        
        # Check total exposure
        current_exposure = sum(abs(p) for p in self.state.positions.values())
        new_exposure = current_exposure + decision.position_size_pct
        if new_exposure > self.limits.max_total_exposure_pct:
            return self._block("max_exposure")
        
        # Check volatility
        if current_volatility > 0 and symbol in self.volatility_baselines:
            baseline = self.volatility_baselines[symbol]
            if baseline > 0:
                vol_ratio = current_volatility / baseline
                if vol_ratio > self.limits.max_volatility_multiplier:
                    return self._block("high_volatility")
        
        # Check daily loss limit
        if self.state.daily_pnl < -self.limits.max_daily_loss_pct:
            return self._block("daily_loss_limit")
        
        # Check weekly loss limit
        if self.state.weekly_pnl < -self.limits.max_weekly_loss_pct:
            return self._block("weekly_loss_limit")
        
        # Check sector concentration
        if symbol in self.state.symbol_sectors:
            sector = self.state.symbol_sectors[symbol]
            sector_exposure = self._get_sector_exposure(sector)
            if sector_exposure + decision.position_size_pct > self.limits.max_sector_exposure_pct:
                return self._block("sector_concentration")
        
        return True, "passed"
    
    def _get_sector_exposure(self, sector: str) -> float:
        """Calculate current exposure to a sector."""
        exposure = 0.0
        for symbol, size in self.state.positions.items():
            if self.state.symbol_sectors.get(symbol) == sector:
                exposure += abs(size)
        return exposure
    
    def _block(self, reason: str) -> tuple[bool, str]:
        """Record blocked signal."""
        self.total_blocked += 1
        self.block_reasons[reason] = self.block_reasons.get(reason, 0) + 1
        logger.debug("risk_blocked", reason=reason)
        return False, reason
    
    def update_position(self, symbol: str, size: float) -> None:
        """Update position for symbol."""
        if size == 0:
            self.state.positions.pop(symbol, None)
        else:
            self.state.positions[symbol] = size
    
    def update_pnl(self, daily: float, weekly: float) -> None:
        """Update PnL tracking."""
        self.state.daily_pnl = daily
        self.state.weekly_pnl = weekly
    
    def set_volatility_baseline(self, symbol: str, baseline: float) -> None:
        """Set volatility baseline for symbol."""
        self.volatility_baselines[symbol] = baseline
    
    def reset_daily(self) -> None:
        """Reset daily metrics (call at session start)."""
        self.state.daily_pnl = 0.0
    
    def get_stats(self) -> dict:
        """Get risk filter statistics."""
        return {
            'total_checked': self.total_checked,
            'total_blocked': self.total_blocked,
            'pass_rate': (self.total_checked - self.total_blocked) / max(1, self.total_checked),
            'block_reasons': self.block_reasons,
            'current_positions': len(self.state.positions),
            'current_exposure': sum(abs(p) for p in self.state.positions.values())
        }


# Global instance
risk_filter = RiskFilter()

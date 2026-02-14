"""
Profit Validator
The REALITY CHECK of the trading system.

Converts signal accuracy into actual trading profitability.
This is the difference between "model works" and "system makes money".

Features:
- Realistic P&L with slippage and commission
- Edge calculation per signal type
- Profit factor tracking
- Trade outcome validation
- Risk-adjusted returns
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from dataclasses import dataclass
from collections import defaultdict
import structlog

from signal_tracker import signal_tracker, TrackedSignal, SignalStats

logger = structlog.get_logger()


@dataclass
class TradeOutcome:
    """Validated trade outcome with realistic P&L."""
    signal_id: str
    symbol: str
    signal_type: str
    
    # Execution
    entry_price: float
    exit_price: float
    direction: int
    
    # Costs
    slippage_cost: float
    commission_cost: float
    total_cost: float
    
    # P&L
    gross_pnl: float
    net_pnl: float
    pnl_pct: float
    
    # Risk metrics
    max_adverse_pct: float
    risk_reward: float
    
    # Context
    regime: str
    confidence: float
    
    def to_dict(self) -> dict:
        return {
            'signal_id': self.signal_id,
            'symbol': self.symbol,
            'signal_type': self.signal_type,
            'entry_price': self.entry_price,
            'exit_price': self.exit_price,
            'direction': self.direction,
            'slippage_cost': self.slippage_cost,
            'commission_cost': self.commission_cost,
            'gross_pnl': self.gross_pnl,
            'net_pnl': self.net_pnl,
            'pnl_pct': round(self.pnl_pct * 100, 2),
            'max_adverse_pct': round(self.max_adverse_pct * 100, 2),
            'risk_reward': round(self.risk_reward, 2),
            'regime': self.regime,
            'confidence': round(self.confidence, 2)
        }


class ProfitValidator:
    """
    Validates signal profitability with realistic trading assumptions.
    
    Industry best practice: ignore trading costs = fantasy backtests.
    """
    
    # Default trading costs (configurable)
    DEFAULT_SLIPPAGE = 0.001       # 0.1%
    DEFAULT_COMMISSION = 0.0005    # 0.05%
    
    # Minimum samples for reliable stats
    MIN_SAMPLES_FOR_EDGE = 20
    
    def __init__(
        self,
        slippage: float = DEFAULT_SLIPPAGE,
        commission: float = DEFAULT_COMMISSION
    ):
        self.slippage = slippage
        self.commission = commission
        
        # Edge cache (updated periodically)
        self._edge_cache: Dict[str, float] = {}
        self._last_edge_update = datetime.min
        self._edge_ttl = timedelta(minutes=5)
        
        # Outcome history (for profit factor calculation)
        self.outcomes: List[TradeOutcome] = []
        self.max_outcomes = 1000  # Rolling window
        
        # Aggregated metrics
        self.metrics = {
            'total_trades': 0,
            'winning_trades': 0,
            'losing_trades': 0,
            'gross_profit': 0.0,
            'gross_loss': 0.0,
            'net_profit': 0.0
        }
        
        logger.info("profit_validator_initialized",
                   slippage=slippage,
                   commission=commission)
    
    # ==================== VALIDATION ====================
    
    def validate_signal(self, signal: TrackedSignal) -> Optional[TradeOutcome]:
        """
        Validate a completed signal and compute realistic P&L.
        
        Returns None if signal doesn't have outcome data.
        """
        if not signal.outcome_complete:
            return None
        
        # Determine exit price (best available)
        exit_price = signal.price_5m or signal.price_3m or signal.price_1m
        if exit_price is None:
            return None
        
        entry = signal.entry_price
        if entry <= 0:
            return None
        
        # Calculate gross P&L
        if signal.direction > 0:  # Long
            gross_pnl = exit_price - entry
        elif signal.direction < 0:  # Short
            gross_pnl = entry - exit_price
        else:
            gross_pnl = 0
        
        gross_pnl_pct = gross_pnl / entry if entry > 0 else 0
        
        # Calculate costs
        slippage_cost = entry * self.slippage * 2  # Entry + exit
        commission_cost = entry * self.commission * 2
        total_cost = slippage_cost + commission_cost
        total_cost_pct = total_cost / entry
        
        # Net P&L
        net_pnl = gross_pnl - total_cost
        net_pnl_pct = gross_pnl_pct - total_cost_pct
        
        # Max adverse
        max_adverse = signal.max_adverse or 0
        
        # Risk/Reward
        if max_adverse > 0.0001:  # Avoid division by zero
            risk_reward = net_pnl_pct / max_adverse
        else:
            risk_reward = float('inf') if net_pnl_pct > 0 else 0
        
        outcome = TradeOutcome(
            signal_id=signal.signal_id,
            symbol=signal.symbol,
            signal_type=signal.signal_type,
            entry_price=entry,
            exit_price=exit_price,
            direction=signal.direction,
            slippage_cost=slippage_cost,
            commission_cost=commission_cost,
            total_cost=total_cost,
            gross_pnl=gross_pnl,
            net_pnl=net_pnl,
            pnl_pct=net_pnl_pct,
            max_adverse_pct=max_adverse,
            risk_reward=risk_reward,
            regime=signal.regime,
            confidence=signal.confidence
        )
        
        # Update internal tracking
        self._record_outcome(outcome)
        
        return outcome
    
    def _record_outcome(self, outcome: TradeOutcome) -> None:
        """Record outcome and update metrics."""
        self.outcomes.append(outcome)
        
        # Trim to rolling window
        if len(self.outcomes) > self.max_outcomes:
            removed = self.outcomes.pop(0)
            # Adjust metrics for removed outcome
            self._adjust_metrics_for_removal(removed)
        
        # Update metrics
        self.metrics['total_trades'] += 1
        
        if outcome.net_pnl > 0:
            self.metrics['winning_trades'] += 1
            self.metrics['gross_profit'] += outcome.net_pnl
        else:
            self.metrics['losing_trades'] += 1
            self.metrics['gross_loss'] += abs(outcome.net_pnl)
        
        self.metrics['net_profit'] += outcome.net_pnl
        
        logger.debug("trade_validated",
                    signal_id=outcome.signal_id[:8],
                    pnl_pct=round(outcome.pnl_pct * 100, 2))
    
    def _adjust_metrics_for_removal(self, outcome: TradeOutcome) -> None:
        """Adjust rolling metrics when old outcome is removed."""
        self.metrics['total_trades'] -= 1
        
        if outcome.net_pnl > 0:
            self.metrics['winning_trades'] -= 1
            self.metrics['gross_profit'] -= outcome.net_pnl
        else:
            self.metrics['losing_trades'] -= 1
            self.metrics['gross_loss'] -= abs(outcome.net_pnl)
        
        self.metrics['net_profit'] -= outcome.net_pnl
    
    # ==================== EDGE CALCULATION ====================
    
    def get_signal_edge(self, signal_type: str) -> float:
        """
        Get historical edge (expected P&L) for a signal type.
        
        This is THE key metric for position sizing.
        Edge > 0 means signal type is profitable on average.
        """
        # Check cache
        if self._is_cache_valid():
            if signal_type in self._edge_cache:
                return self._edge_cache[signal_type]
        
        # Calculate from signal tracker stats
        stats = signal_tracker.stats_cache.get(signal_type)
        
        if not stats or stats.completed_signals < self.MIN_SAMPLES_FOR_EDGE:
            # Not enough data
            logger.debug("edge_insufficient_data",
                        signal_type=signal_type,
                        samples=stats.completed_signals if stats else 0)
            return 0.0
        
        # Edge = average net P&L per trade
        edge = stats.avg_profit_pct
        
        # Cache it
        self._edge_cache[signal_type] = edge
        self._last_edge_update = datetime.now()
        
        logger.info("edge_calculated",
                   signal_type=signal_type,
                   edge=round(edge * 100, 2),
                   samples=stats.completed_signals)
        
        return edge
    
    def get_all_edges(self) -> Dict[str, float]:
        """Get edges for all signal types."""
        edges = {}
        for signal_type in signal_tracker.stats_cache.keys():
            edges[signal_type] = self.get_signal_edge(signal_type)
        return edges
    
    def _is_cache_valid(self) -> bool:
        """Check if edge cache is still valid."""
        return datetime.now() - self._last_edge_update < self._edge_ttl
    
    # ==================== PROFIT FACTOR ====================
    
    def get_profit_factor(self, signal_type: Optional[str] = None) -> float:
        """
        Calculate profit factor (gross wins / gross losses).
        
        Target: > 1.5 for healthy system
        > 2.0 is excellent
        < 1.0 means losing money
        """
        if signal_type:
            outcomes = [o for o in self.outcomes if o.signal_type == signal_type]
        else:
            outcomes = self.outcomes
        
        gross_wins = sum(o.net_pnl for o in outcomes if o.net_pnl > 0)
        gross_losses = sum(abs(o.net_pnl) for o in outcomes if o.net_pnl < 0)
        
        if gross_losses > 0:
            return gross_wins / gross_losses
        elif gross_wins > 0:
            return float('inf')
        else:
            return 0.0
    
    def get_win_rate(self, signal_type: Optional[str] = None) -> float:
        """Get win rate for signal type or overall."""
        if signal_type:
            outcomes = [o for o in self.outcomes if o.signal_type == signal_type]
        else:
            outcomes = self.outcomes
        
        if not outcomes:
            return 0.5  # Default
        
        winners = sum(1 for o in outcomes if o.net_pnl > 0)
        return winners / len(outcomes)
    
    # ==================== EXPECTANCY ====================
    
    def get_expectancy(self, signal_type: Optional[str] = None) -> float:
        """
        Calculate expectancy (expected value per trade).
        
        E = (Win% × Avg Win) - (Loss% × Avg Loss)
        
        Positive expectancy = profitable system
        """
        if signal_type:
            outcomes = [o for o in self.outcomes if o.signal_type == signal_type]
        else:
            outcomes = self.outcomes
        
        if len(outcomes) < 10:
            return 0.0  # Not enough data
        
        winners = [o for o in outcomes if o.net_pnl > 0]
        losers = [o for o in outcomes if o.net_pnl < 0]
        
        win_rate = len(winners) / len(outcomes)
        loss_rate = 1 - win_rate
        
        avg_win = sum(o.pnl_pct for o in winners) / len(winners) if winners else 0
        avg_loss = abs(sum(o.pnl_pct for o in losers) / len(losers)) if losers else 0
        
        expectancy = (win_rate * avg_win) - (loss_rate * avg_loss)
        return expectancy
    
    # ==================== REGIME ANALYSIS ====================
    
    def get_regime_performance(self) -> Dict[str, Dict[str, float]]:
        """Get performance breakdown by regime."""
        regime_stats = defaultdict(lambda: {
            'count': 0,
            'wins': 0,
            'total_pnl': 0.0,
            'win_rate': 0.0,
            'avg_pnl': 0.0
        })
        
        for outcome in self.outcomes:
            regime = outcome.regime
            regime_stats[regime]['count'] += 1
            regime_stats[regime]['total_pnl'] += outcome.pnl_pct
            if outcome.net_pnl > 0:
                regime_stats[regime]['wins'] += 1
        
        # Calculate rates
        for regime, stats in regime_stats.items():
            if stats['count'] > 0:
                stats['win_rate'] = stats['wins'] / stats['count']
                stats['avg_pnl'] = stats['total_pnl'] / stats['count']
        
        return dict(regime_stats)
    
    # ==================== REPORTS ====================
    
    def get_summary(self) -> dict:
        """Get comprehensive performance summary."""
        return {
            'total_trades': self.metrics['total_trades'],
            'winning_trades': self.metrics['winning_trades'],
            'losing_trades': self.metrics['losing_trades'],
            'win_rate': self.get_win_rate(),
            'gross_profit': round(self.metrics['gross_profit'], 2),
            'gross_loss': round(self.metrics['gross_loss'], 2),
            'net_profit': round(self.metrics['net_profit'], 2),
            'profit_factor': round(self.get_profit_factor(), 2),
            'expectancy': round(self.get_expectancy() * 100, 2),
            'edges': {
                k: round(v * 100, 2) 
                for k, v in self.get_all_edges().items()
            },
            'regime_performance': self.get_regime_performance()
        }
    
    def get_daily_pnl(self) -> Dict[str, float]:
        """Get P&L breakdown by day (for dashboard)."""
        daily = defaultdict(float)
        
        for outcome in self.outcomes:
            # Need timestamp from signal
            signal = signal_tracker.get_signal(outcome.signal_id)
            if signal:
                day = signal.timestamp.strftime('%Y-%m-%d')
                daily[day] += outcome.pnl_pct
        
        return dict(daily)


# Singleton instance
profit_validator = ProfitValidator()


# ==================== INTEGRATION ====================

def get_sizing_multiplier(signal_type: str) -> float:
    """
    Get Kelly-inspired sizing multiplier based on edge.
    
    Used by DecisionEngine to adjust position sizes.
    
    Returns:
        1.5 for edge > 2%
        1.0 for edge > 0
        0.5 for edge <= 0
    """
    edge = profit_validator.get_signal_edge(signal_type)
    
    if edge > 0.02:  # 2%+ proven edge
        return 1.5
    elif edge > 0:
        return 1.0
    else:
        return 0.5  # Reduce for unprofitable signals

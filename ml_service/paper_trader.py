"""
Paper Trading Logger (Phase 7.5 Core)
The TRUTH FOUNDATION of the validation layer.

NO EXECUTION. NO MONEY. ONLY TRUTH.

This module:
- Logs every signal without executing
- Tracks outcomes over time
- Aggregates daily/cumulative metrics
- Provides evidence for gate validation
- Creates behavioral profile

Without this, trust is impossible.
Without trust, automation is suicide.
"""
import asyncio
from datetime import datetime, date, timedelta
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field, asdict
from collections import defaultdict
from enum import Enum
import json
import structlog
import redis.asyncio as aioredis

from signal_tracker import signal_tracker, TrackedSignal

logger = structlog.get_logger()


@dataclass
class PaperTrade:
    """A logged trade (no execution, signal only)."""
    trade_id: str
    signal_id: str
    symbol: str
    timestamp: datetime
    
    # Signal data
    signal_type: str
    direction: int
    confidence: float
    regime: str
    
    # Price context
    entry_price: float
    
    # Outcomes (filled later)
    exit_price: Optional[float] = None
    exit_time: Optional[datetime] = None
    
    # P&L (filled after exit)
    gross_pnl_pct: Optional[float] = None
    net_pnl_pct: Optional[float] = None
    
    # Risk metrics
    max_drawdown_pct: Optional[float] = None
    max_profit_pct: Optional[float] = None
    duration_minutes: Optional[int] = None
    
    # Status
    is_closed: bool = False
    close_reason: str = ""  # 'target', 'stop', 'timeout', 'manual'
    
    def to_dict(self) -> dict:
        d = asdict(self)
        d['timestamp'] = self.timestamp.isoformat()
        if self.exit_time:
            d['exit_time'] = self.exit_time.isoformat()
        return d


@dataclass
class DailyMetrics:
    """Daily aggregated metrics."""
    date: date
    
    # Activity
    total_signals: int = 0
    total_trades: int = 0
    
    # Win/Loss
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    
    # P&L
    gross_profit: float = 0.0
    gross_loss: float = 0.0
    net_pnl: float = 0.0
    
    # Risk
    max_drawdown: float = 0.0
    
    # Regime breakdown
    regime_counts: Dict[str, int] = field(default_factory=dict)
    regime_pnl: Dict[str, float] = field(default_factory=dict)
    
    # Discipline
    violations: int = 0
    
    # Quality
    avg_confidence: float = 0.0
    profit_factor: float = 0.0
    expectancy: float = 0.0
    
    def to_dict(self) -> dict:
        return {
            'date': self.date.isoformat(),
            'total_signals': self.total_signals,
            'total_trades': self.total_trades,
            'winning_trades': self.winning_trades,
            'losing_trades': self.losing_trades,
            'win_rate': round(self.win_rate, 3),
            'gross_profit': round(self.gross_profit, 4),
            'gross_loss': round(self.gross_loss, 4),
            'net_pnl': round(self.net_pnl, 4),
            'max_drawdown': round(self.max_drawdown, 4),
            'regime_counts': self.regime_counts,
            'regime_pnl': {k: round(v, 4) for k, v in self.regime_pnl.items()},
            'violations': self.violations,
            'avg_confidence': round(self.avg_confidence, 3),
            'profit_factor': round(self.profit_factor, 2),
            'expectancy': round(self.expectancy, 4)
        }


@dataclass
class CumulativeStats:
    """Overall cumulative statistics."""
    start_date: date
    end_date: date
    
    # Totals
    total_days: int = 0
    total_signals: int = 0
    total_trades: int = 0
    
    # Performance
    total_pnl: float = 0.0
    avg_daily_pnl: float = 0.0
    best_day_pnl: float = 0.0
    worst_day_pnl: float = 0.0
    
    # Win/Loss
    total_wins: int = 0
    total_losses: int = 0
    overall_win_rate: float = 0.0
    
    # Risk
    max_drawdown: float = 0.0
    
    # Quality
    profit_factor: float = 0.0
    expectancy: float = 0.0
    sharpe_estimate: float = 0.0


class PaperTrader:
    """
    Paper Trading Engine - Truth Collection System.
    
    NO EXECUTION. NO MONEY. ONLY OBSERVATION.
    
    This creates the behavioral profile that determines
    whether the system can be trusted with real money.
    """
    
    # Trading costs for P&L calculation
    SLIPPAGE = 0.001       # 0.1%
    COMMISSION = 0.0005    # 0.05%
    
    # Trade timeout (auto-close after this)
    DEFAULT_TIMEOUT_MINUTES = 60
    
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        max_trades: int = 10000
    ):
        self.redis_url = redis_url
        self.redis: Optional[aioredis.Redis] = None
        self.max_trades = max_trades
        
        # Trade storage
        self.trades: Dict[str, PaperTrade] = {}
        self.closed_trades: List[PaperTrade] = []
        
        # Daily metrics
        self.daily_metrics: Dict[date, DailyMetrics] = {}
        
        # Counters
        self._trade_counter = 0
        
        logger.info("paper_trader_initialized", max_trades=max_trades)
    
    async def connect(self) -> bool:
        """Connect to Redis."""
        try:
            self.redis = aioredis.from_url(self.redis_url)
            await self.redis.ping()
            logger.info("paper_trader_redis_connected")
            return True
        except Exception as e:
            logger.warning("paper_trader_redis_failed", error=str(e))
            return False
    
    async def close(self) -> None:
        """Cleanup."""
        if self.redis:
            await self.redis.close()
    
    # ==================== TRADE LOGGING ====================
    
    async def log_signal(
        self,
        signal_id: str,
        symbol: str,
        signal_type: str,
        direction: int,
        confidence: float,
        regime: str,
        entry_price: float
    ) -> str:
        """
        Log a signal as a paper trade.
        
        NO EXECUTION. Just record the intent.
        """
        self._trade_counter += 1
        trade_id = f"PT-{datetime.now().strftime('%Y%m%d')}-{self._trade_counter:05d}"
        
        trade = PaperTrade(
            trade_id=trade_id,
            signal_id=signal_id,
            symbol=symbol,
            timestamp=datetime.now(),
            signal_type=signal_type,
            direction=direction,
            confidence=confidence,
            regime=regime,
            entry_price=entry_price
        )
        
        self.trades[trade_id] = trade
        
        # Trim if needed
        if len(self.trades) > self.max_trades:
            self._archive_oldest()
        
        # Update daily metrics
        self._update_daily_signal(trade)
        
        # Publish to Redis for monitoring
        if self.redis:
            await self._publish_trade(trade)
        
        logger.info("paper_trade_logged",
                   trade_id=trade_id,
                   symbol=symbol,
                   type=signal_type,
                   regime=regime)
        
        return trade_id
    
    async def close_trade(
        self,
        trade_id: str,
        exit_price: float,
        reason: str = "manual"
    ) -> Optional[PaperTrade]:
        """
        Close a paper trade and calculate P&L.
        """
        if trade_id not in self.trades:
            return None
        
        trade = self.trades[trade_id]
        if trade.is_closed:
            return trade
        
        trade.exit_price = exit_price
        trade.exit_time = datetime.now()
        trade.close_reason = reason
        trade.is_closed = True
        
        # Calculate duration
        duration = (trade.exit_time - trade.timestamp).total_seconds() / 60
        trade.duration_minutes = int(duration)
        
        # Calculate P&L
        entry = trade.entry_price
        if trade.direction > 0:  # Long
            gross = (exit_price - entry) / entry
        elif trade.direction < 0:  # Short
            gross = (entry - exit_price) / entry
        else:
            gross = 0
        
        trade.gross_pnl_pct = gross
        trade.net_pnl_pct = gross - self.SLIPPAGE - self.COMMISSION
        
        # Move to closed
        self.closed_trades.append(trade)
        del self.trades[trade_id]
        
        # Update daily metrics
        self._update_daily_trade(trade)
        
        logger.info("paper_trade_closed",
                   trade_id=trade_id,
                   pnl=round(trade.net_pnl_pct * 100, 2),
                   reason=reason)
        
        return trade
    
    async def auto_close_expired(self, timeout_minutes: int = None) -> int:
        """Close trades that exceeded timeout."""
        timeout = timeout_minutes or self.DEFAULT_TIMEOUT_MINUTES
        cutoff = datetime.now() - timedelta(minutes=timeout)
        closed = 0
        
        for trade_id, trade in list(self.trades.items()):
            if trade.timestamp < cutoff:
                # Get current price from signal tracker or default
                exit_price = trade.entry_price  # Fallback
                signal = signal_tracker.get_signal(trade.signal_id)
                if signal and signal.price_5m:
                    exit_price = signal.price_5m
                
                await self.close_trade(trade_id, exit_price, "timeout")
                closed += 1
        
        return closed
    
    def _archive_oldest(self) -> None:
        """Move oldest open trades to closed."""
        if not self.trades:
            return
        
        oldest = min(self.trades.values(), key=lambda t: t.timestamp)
        # Force close at entry (neutral)
        oldest.exit_price = oldest.entry_price
        oldest.exit_time = datetime.now()
        oldest.is_closed = True
        oldest.close_reason = "buffer_overflow"
        oldest.net_pnl_pct = 0
        
        self.closed_trades.append(oldest)
        del self.trades[oldest.trade_id]
    
    async def _publish_trade(self, trade: PaperTrade) -> None:
        """Publish trade to Redis."""
        try:
            await self.redis.publish(
                "paper_trades",
                json.dumps(trade.to_dict())
            )
        except Exception as e:
            logger.debug("trade_publish_failed", error=str(e))
    
    # ==================== DAILY METRICS ====================
    
    def _update_daily_signal(self, trade: PaperTrade) -> None:
        """Update daily metrics for new signal."""
        today = trade.timestamp.date()
        
        if today not in self.daily_metrics:
            self.daily_metrics[today] = DailyMetrics(date=today)
        
        metrics = self.daily_metrics[today]
        metrics.total_signals += 1
        
        # Regime tracking
        regime = trade.regime
        metrics.regime_counts[regime] = metrics.regime_counts.get(regime, 0) + 1
        
        # Running confidence average
        n = metrics.total_signals
        metrics.avg_confidence = (
            metrics.avg_confidence * (n - 1) + trade.confidence
        ) / n
    
    def _update_daily_trade(self, trade: PaperTrade) -> None:
        """Update daily metrics for closed trade."""
        trade_date = trade.timestamp.date()
        
        if trade_date not in self.daily_metrics:
            self.daily_metrics[trade_date] = DailyMetrics(date=trade_date)
        
        metrics = self.daily_metrics[trade_date]
        metrics.total_trades += 1
        
        pnl = trade.net_pnl_pct or 0
        
        if pnl > 0:
            metrics.winning_trades += 1
            metrics.gross_profit += pnl
        else:
            metrics.losing_trades += 1
            metrics.gross_loss += abs(pnl)
        
        metrics.net_pnl += pnl
        
        # Win rate
        if metrics.total_trades > 0:
            metrics.win_rate = metrics.winning_trades / metrics.total_trades
        
        # Profit factor
        if metrics.gross_loss > 0:
            metrics.profit_factor = metrics.gross_profit / metrics.gross_loss
        elif metrics.gross_profit > 0:
            metrics.profit_factor = float('inf')
        
        # Regime P&L
        regime = trade.regime
        metrics.regime_pnl[regime] = metrics.regime_pnl.get(regime, 0) + pnl
        
        # Max drawdown (simplified: running min of net_pnl)
        if pnl < 0 and abs(pnl) > abs(metrics.max_drawdown):
            metrics.max_drawdown = pnl
    
    # ==================== REPORTING ====================
    
    def get_daily_report(self, target_date: date = None) -> DailyMetrics:
        """Get metrics for a specific day."""
        target = target_date or date.today()
        return self.daily_metrics.get(target, DailyMetrics(date=target))
    
    def get_cumulative_stats(self) -> CumulativeStats:
        """Get overall cumulative statistics."""
        if not self.daily_metrics:
            return CumulativeStats(
                start_date=date.today(),
                end_date=date.today()
            )
        
        sorted_dates = sorted(self.daily_metrics.keys())
        
        stats = CumulativeStats(
            start_date=sorted_dates[0],
            end_date=sorted_dates[-1],
            total_days=len(sorted_dates)
        )
        
        daily_pnls = []
        
        for d in sorted_dates:
            m = self.daily_metrics[d]
            stats.total_signals += m.total_signals
            stats.total_trades += m.total_trades
            stats.total_wins += m.winning_trades
            stats.total_losses += m.losing_trades
            stats.total_pnl += m.net_pnl
            daily_pnls.append(m.net_pnl)
            
            if m.net_pnl > stats.best_day_pnl:
                stats.best_day_pnl = m.net_pnl
            if m.net_pnl < stats.worst_day_pnl:
                stats.worst_day_pnl = m.net_pnl
        
        # Averages
        if stats.total_days > 0:
            stats.avg_daily_pnl = stats.total_pnl / stats.total_days
        
        if stats.total_trades > 0:
            stats.overall_win_rate = stats.total_wins / stats.total_trades
        
        # Max drawdown (cumulative)
        running_pnl = 0
        peak = 0
        for pnl in daily_pnls:
            running_pnl += pnl
            if running_pnl > peak:
                peak = running_pnl
            drawdown = peak - running_pnl
            if drawdown > stats.max_drawdown:
                stats.max_drawdown = drawdown
        
        return stats
    
    def generate_eod_report(self) -> str:
        """Generate end-of-day text report."""
        today = date.today()
        metrics = self.get_daily_report(today)
        cumulative = self.get_cumulative_stats()
        
        report = f"""
📊 Daily Report - {today}
─────────────────────────────
Signals: {metrics.total_signals}
Trades: {metrics.total_trades}
Win Rate: {metrics.win_rate:.0%}
Net P&L: {metrics.net_pnl*100:+.2f}%
Violations: {metrics.violations}
─────────────────────────────
Cumulative ({cumulative.total_days} days):
Total P&L: {cumulative.total_pnl*100:+.2f}%
Overall Win Rate: {cumulative.overall_win_rate:.0%}
Max Drawdown: {cumulative.max_drawdown*100:.2f}%
─────────────────────────────
"""
        return report.strip()
    
    # ==================== QUERIES ====================
    
    def get_open_trades(self) -> List[PaperTrade]:
        """Get all open paper trades."""
        return list(self.trades.values())
    
    def get_recent_closed(self, n: int = 20) -> List[PaperTrade]:
        """Get recent closed trades."""
        return self.closed_trades[-n:]
    
    def get_trades_by_regime(self, regime: str) -> List[PaperTrade]:
        """Get all trades for a specific regime."""
        return [
            t for t in self.closed_trades 
            if t.regime == regime
        ]
    
    def get_regime_stats(self) -> Dict[str, Dict]:
        """Get performance breakdown by regime."""
        stats = defaultdict(lambda: {
            'count': 0,
            'wins': 0,
            'total_pnl': 0,
            'avg_pnl': 0
        })
        
        for trade in self.closed_trades:
            regime = trade.regime
            stats[regime]['count'] += 1
            stats[regime]['total_pnl'] += trade.net_pnl_pct or 0
            if trade.net_pnl_pct and trade.net_pnl_pct > 0:
                stats[regime]['wins'] += 1
        
        for regime, s in stats.items():
            if s['count'] > 0:
                s['avg_pnl'] = s['total_pnl'] / s['count']
                s['win_rate'] = s['wins'] / s['count']
        
        return dict(stats)


# Singleton instance
paper_trader = PaperTrader()


# ==================== INTEGRATION ====================

async def log_paper_trade(
    signal_id: str,
    symbol: str,
    signal_type: str,
    direction: int,
    confidence: float,
    regime: str,
    entry_price: float
) -> str:
    """Integration helper for realtime.py"""
    return await paper_trader.log_signal(
        signal_id=signal_id,
        symbol=symbol,
        signal_type=signal_type,
        direction=direction,
        confidence=confidence,
        regime=regime,
        entry_price=entry_price
    )

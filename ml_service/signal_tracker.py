"""
Signal Tracker (System Hippocampus)
Tracks all signals and their real-world outcomes.

This is the TRUTH SYSTEM of the trading brain.
Without this, ML is blind and learning is fake.

Features:
- UUID-based signal tracking
- Outcome capture at 1m, 3m, 5m, 15m
- Accuracy calculation per signal type
- P&L with realistic slippage
- Max adverse excursion (drawdown)
- Redis integration for real-time
- Prometheus metrics hooks
- Async performance optimized
"""
import uuid
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field, asdict
from collections import defaultdict
from enum import Enum
import json
import structlog
import redis.asyncio as aioredis

logger = structlog.get_logger()


class SignalType(str, Enum):
    """Signal classification types."""
    PUMP = "pump"
    DUMP = "dump"
    HOLD = "hold"
    STRONG_BUY = "strong_buy"
    BUY = "buy"
    SELL = "sell"
    STRONG_SELL = "strong_sell"


@dataclass
class TrackedSignal:
    """
    Complete signal record with outcomes.
    This is the atomic unit of trading truth.
    """
    # Identity
    signal_id: str
    symbol: str
    timestamp: datetime
    
    # Signal data
    signal_type: str
    confidence: float
    regime: str
    direction: int              # -1, 0, 1
    signal_strength: float
    
    # Entry context
    entry_price: float
    atr: float = 0.0
    
    # Agent breakdown (for analysis)
    agent_signals: Dict[str, float] = field(default_factory=dict)
    agreement_score: float = 0.0
    
    # Future outcomes (filled by outcome tracker)
    price_1m: Optional[float] = None
    price_3m: Optional[float] = None
    price_5m: Optional[float] = None
    price_15m: Optional[float] = None
    
    # Price extremes (for max adverse/favorable)
    min_price_5m: Optional[float] = None
    max_price_5m: Optional[float] = None
    
    # Computed metrics (filled after outcomes)
    accuracy: Optional[bool] = None
    profit_pct: Optional[float] = None
    max_adverse: Optional[float] = None     # Max drawdown after entry
    max_favorable: Optional[float] = None   # Max profit achieved
    
    # Tracking status
    outcome_complete: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for storage/transmission."""
        d = asdict(self)
        d['timestamp'] = self.timestamp.isoformat()
        d['created_at'] = self.created_at.isoformat()
        return d
    
    @classmethod
    def from_dict(cls, data: dict) -> 'TrackedSignal':
        """Reconstruct from dictionary."""
        data = data.copy()
        data['timestamp'] = datetime.fromisoformat(data['timestamp'])
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        return cls(**data)


@dataclass
class SignalStats:
    """Aggregated statistics for a signal type."""
    signal_type: str
    total_signals: int = 0
    completed_signals: int = 0
    
    # Accuracy
    correct_predictions: int = 0
    accuracy_rate: float = 0.0
    
    # Profitability
    total_profit_pct: float = 0.0
    avg_profit_pct: float = 0.0
    max_profit_pct: float = 0.0
    min_profit_pct: float = 0.0
    
    # Risk metrics
    avg_adverse: float = 0.0
    max_adverse: float = 0.0
    
    # Profit factor
    gross_wins: float = 0.0
    gross_losses: float = 0.0
    profit_factor: float = 0.0
    
    # Edge (expected value per trade)
    edge: float = 0.0


class SignalTracker:
    """
    Production-grade signal tracking system.
    
    Architecture:
    - In-memory buffer for speed
    - Redis pub/sub for real-time
    - Periodic flush to persistent storage
    - Async outcome scheduling
    """
    
    # Outcome horizons in seconds
    OUTCOME_HORIZONS = {
        '1m': 60,
        '3m': 180,
        '5m': 300,
        '15m': 900
    }
    
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        buffer_size: int = 10000,
        slippage: float = 0.001,      # 0.1%
        commission: float = 0.0005    # 0.05%
    ):
        self.redis_url = redis_url
        self.redis: Optional[aioredis.Redis] = None
        self.buffer_size = buffer_size
        self.slippage = slippage
        self.commission = commission
        
        # In-memory signal buffer
        self.signals: Dict[str, TrackedSignal] = {}
        
        # Pending outcome tasks
        self.pending_outcomes: Dict[str, asyncio.Task] = {}
        
        # Statistics cache
        self.stats_cache: Dict[str, SignalStats] = defaultdict(
            lambda: SignalStats(signal_type="unknown")
        )
        
        # Counters for Prometheus
        self.metrics = {
            'signals_recorded': 0,
            'outcomes_captured': 0,
            'outcomes_missed': 0,
            'accuracy_updates': 0
        }
        
        logger.info("signal_tracker_initialized",
                   buffer_size=buffer_size,
                   slippage=slippage)
    
    async def connect(self) -> bool:
        """Connect to Redis."""
        try:
            self.redis = aioredis.from_url(self.redis_url)
            await self.redis.ping()
            logger.info("signal_tracker_redis_connected")
            return True
        except Exception as e:
            logger.warning("signal_tracker_redis_failed", error=str(e))
            return False
    
    async def close(self) -> None:
        """Cleanup resources."""
        # Cancel pending tasks
        for task in self.pending_outcomes.values():
            task.cancel()
        
        if self.redis:
            await self.redis.close()
        
        logger.info("signal_tracker_closed",
                   pending_cancelled=len(self.pending_outcomes))
    
    # ==================== RECORDING ====================
    
    async def record_signal(
        self,
        symbol: str,
        signal_type: str,
        confidence: float,
        regime: str,
        direction: int,
        signal_strength: float,
        entry_price: float,
        atr: float = 0.0,
        agent_signals: Optional[Dict[str, float]] = None,
        agreement_score: float = 0.0
    ) -> str:
        """
        Record a new signal and schedule outcome tracking.
        
        Returns: signal_id (UUID)
        """
        signal_id = str(uuid.uuid4())
        
        signal = TrackedSignal(
            signal_id=signal_id,
            symbol=symbol,
            timestamp=datetime.now(),
            signal_type=signal_type,
            confidence=confidence,
            regime=regime,
            direction=direction,
            signal_strength=signal_strength,
            entry_price=entry_price,
            atr=atr,
            agent_signals=agent_signals or {},
            agreement_score=agreement_score
        )
        
        # Store in buffer
        self.signals[signal_id] = signal
        self.metrics['signals_recorded'] += 1
        
        # Trim buffer if needed
        if len(self.signals) > self.buffer_size:
            self._trim_buffer()
        
        # Publish to Redis for other services
        if self.redis:
            await self._publish_signal(signal)
        
        # Schedule outcome tracking
        self._schedule_outcome_tracking(signal_id)
        
        logger.info("signal_recorded",
                   signal_id=signal_id[:8],
                   symbol=symbol,
                   type=signal_type,
                   confidence=round(confidence, 2))
        
        return signal_id
    
    def _trim_buffer(self) -> None:
        """Remove oldest completed signals to free memory."""
        completed = [
            sid for sid, s in self.signals.items() 
            if s.outcome_complete
        ]
        
        # Sort by timestamp and remove oldest
        completed.sort(key=lambda sid: self.signals[sid].timestamp)
        
        to_remove = len(self.signals) - self.buffer_size + 100
        for sid in completed[:to_remove]:
            del self.signals[sid]
        
        logger.debug("signal_buffer_trimmed", removed=to_remove)
    
    async def _publish_signal(self, signal: TrackedSignal) -> None:
        """Publish signal to Redis for other services."""
        try:
            channel = f"signals.tracked.{signal.symbol}"
            await self.redis.publish(channel, json.dumps(signal.to_dict()))
        except Exception as e:
            logger.warning("signal_publish_failed", error=str(e))
    
    # ==================== OUTCOME TRACKING ====================
    
    def _schedule_outcome_tracking(self, signal_id: str) -> None:
        """Schedule async tasks to capture outcomes at each horizon."""
        for horizon_name, seconds in self.OUTCOME_HORIZONS.items():
            task = asyncio.create_task(
                self._capture_outcome(signal_id, horizon_name, seconds)
            )
            task_key = f"{signal_id}_{horizon_name}"
            self.pending_outcomes[task_key] = task
    
    async def _capture_outcome(
        self, 
        signal_id: str, 
        horizon: str, 
        wait_seconds: int
    ) -> None:
        """Wait and capture price at horizon."""
        try:
            await asyncio.sleep(wait_seconds)
            
            if signal_id not in self.signals:
                return
            
            signal = self.signals[signal_id]
            
            # Get current price from Redis or data source
            current_price = await self._get_current_price(signal.symbol)
            
            if current_price is None:
                self.metrics['outcomes_missed'] += 1
                return
            
            # Update the appropriate field
            if horizon == '1m':
                signal.price_1m = current_price
            elif horizon == '3m':
                signal.price_3m = current_price
            elif horizon == '5m':
                signal.price_5m = current_price
                # Calculate metrics after 5m
                self._calculate_signal_metrics(signal)
            elif horizon == '15m':
                signal.price_15m = current_price
                signal.outcome_complete = True
                # Final calculation
                self._calculate_signal_metrics(signal)
                self._update_stats(signal)
            
            self.metrics['outcomes_captured'] += 1
            
            logger.debug("outcome_captured",
                        signal_id=signal_id[:8],
                        horizon=horizon,
                        price=current_price)
            
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("outcome_capture_failed",
                         signal_id=signal_id[:8],
                         horizon=horizon,
                         error=str(e))
        finally:
            task_key = f"{signal_id}_{horizon}"
            self.pending_outcomes.pop(task_key, None)
    
    async def _get_current_price(self, symbol: str) -> Optional[float]:
        """Get current price from Redis or data source."""
        if not self.redis:
            return None
        
        try:
            # Try to get from Redis tick data
            key = f"price.{symbol}"
            price_str = await self.redis.get(key)
            if price_str:
                return float(price_str)
            
            # Fallback: get from last tick
            tick_key = f"tick.last.{symbol}"
            tick_data = await self.redis.get(tick_key)
            if tick_data:
                tick = json.loads(tick_data)
                return float(tick.get('price', tick.get('close', 0)))
            
            return None
        except Exception as e:
            logger.warning("price_fetch_failed", symbol=symbol, error=str(e))
            return None
    
    async def update_outcome(
        self,
        signal_id: str,
        horizon: str,
        price: float
    ) -> bool:
        """Manually update outcome (for batch processing)."""
        if signal_id not in self.signals:
            return False
        
        signal = self.signals[signal_id]
        
        if horizon == '1m':
            signal.price_1m = price
        elif horizon == '3m':
            signal.price_3m = price
        elif horizon == '5m':
            signal.price_5m = price
            self._calculate_signal_metrics(signal)
        elif horizon == '15m':
            signal.price_15m = price
            signal.outcome_complete = True
            self._calculate_signal_metrics(signal)
            self._update_stats(signal)
        
        return True
    
    # ==================== METRICS CALCULATION ====================
    
    def _calculate_signal_metrics(self, signal: TrackedSignal) -> None:
        """Calculate accuracy and profit for a signal."""
        entry = signal.entry_price
        if entry <= 0:
            return
        
        # Get best available exit price
        exit_price = (
            signal.price_5m or 
            signal.price_3m or 
            signal.price_1m
        )
        
        if exit_price is None:
            return
        
        # Calculate raw P&L
        if signal.direction > 0:  # Long
            raw_pnl = (exit_price - entry) / entry
        elif signal.direction < 0:  # Short
            raw_pnl = (entry - exit_price) / entry
        else:
            raw_pnl = 0
        
        # Apply trading costs
        total_cost = self.slippage + self.commission
        signal.profit_pct = raw_pnl - total_cost
        
        # Calculate accuracy (direction correct)
        if signal.direction > 0:
            signal.accuracy = exit_price > entry
        elif signal.direction < 0:
            signal.accuracy = exit_price < entry
        else:
            signal.accuracy = True  # Hold is always "correct"
        
        # Calculate max adverse excursion
        if signal.min_price_5m and signal.direction > 0:
            signal.max_adverse = (entry - signal.min_price_5m) / entry
        elif signal.max_price_5m and signal.direction < 0:
            signal.max_adverse = (signal.max_price_5m - entry) / entry
        
        # Calculate max favorable excursion
        if signal.max_price_5m and signal.direction > 0:
            signal.max_favorable = (signal.max_price_5m - entry) / entry
        elif signal.min_price_5m and signal.direction < 0:
            signal.max_favorable = (entry - signal.min_price_5m) / entry
        
        self.metrics['accuracy_updates'] += 1
    
    def _update_stats(self, signal: TrackedSignal) -> None:
        """Update aggregated statistics for signal type."""
        stats = self.stats_cache[signal.signal_type]
        stats.signal_type = signal.signal_type
        stats.total_signals += 1
        
        if signal.outcome_complete:
            stats.completed_signals += 1
        
        if signal.accuracy is not None:
            if signal.accuracy:
                stats.correct_predictions += 1
            stats.accuracy_rate = (
                stats.correct_predictions / stats.completed_signals
                if stats.completed_signals > 0 else 0
            )
        
        if signal.profit_pct is not None:
            stats.total_profit_pct += signal.profit_pct
            
            if signal.profit_pct > 0:
                stats.gross_wins += signal.profit_pct
            else:
                stats.gross_losses += abs(signal.profit_pct)
            
            stats.avg_profit_pct = (
                stats.total_profit_pct / stats.completed_signals
                if stats.completed_signals > 0 else 0
            )
            
            if signal.profit_pct > stats.max_profit_pct:
                stats.max_profit_pct = signal.profit_pct
            if signal.profit_pct < stats.min_profit_pct:
                stats.min_profit_pct = signal.profit_pct
        
        if signal.max_adverse is not None:
            # Rolling average of max adverse
            old_avg = stats.avg_adverse
            n = stats.completed_signals
            stats.avg_adverse = old_avg + (signal.max_adverse - old_avg) / n
            
            if signal.max_adverse > stats.max_adverse:
                stats.max_adverse = signal.max_adverse
        
        # Profit factor
        if stats.gross_losses > 0:
            stats.profit_factor = stats.gross_wins / stats.gross_losses
        elif stats.gross_wins > 0:
            stats.profit_factor = float('inf')
        
        # Edge (expected value)
        stats.edge = stats.avg_profit_pct
    
    # ==================== QUERIES ====================
    
    def get_signal(self, signal_id: str) -> Optional[TrackedSignal]:
        """Get a specific signal by ID."""
        return self.signals.get(signal_id)
    
    def get_recent_signals(
        self, 
        symbol: Optional[str] = None,
        signal_type: Optional[str] = None,
        limit: int = 100
    ) -> List[TrackedSignal]:
        """Get recent signals with optional filters."""
        signals = list(self.signals.values())
        
        if symbol:
            signals = [s for s in signals if s.symbol == symbol]
        
        if signal_type:
            signals = [s for s in signals if s.signal_type == signal_type]
        
        # Sort by timestamp descending
        signals.sort(key=lambda s: s.timestamp, reverse=True)
        
        return signals[:limit]
    
    def get_stats(self, signal_type: Optional[str] = None) -> Dict[str, SignalStats]:
        """Get statistics, optionally filtered by type."""
        if signal_type:
            return {signal_type: self.stats_cache.get(
                signal_type, 
                SignalStats(signal_type=signal_type)
            )}
        return dict(self.stats_cache)
    
    def get_edge(self, signal_type: str) -> float:
        """Get historical edge for a signal type."""
        stats = self.stats_cache.get(signal_type)
        if stats and stats.completed_signals >= 10:
            return stats.edge
        return 0.0  # Not enough data
    
    def get_accuracy(self, signal_type: str) -> float:
        """Get accuracy rate for a signal type."""
        stats = self.stats_cache.get(signal_type)
        if stats and stats.completed_signals >= 10:
            return stats.accuracy_rate
        return 0.5  # Default to 50%
    
    def get_metrics(self) -> dict:
        """Get Prometheus-compatible metrics."""
        return {
            **self.metrics,
            'buffer_size': len(self.signals),
            'pending_outcomes': len(self.pending_outcomes),
            'signal_types_tracked': len(self.stats_cache)
        }


# Singleton instance
signal_tracker = SignalTracker()


# ==================== INTEGRATION HELPERS ====================

async def record_from_fused_signal(
    symbol: str,
    fused_signal: Any,  # FusedSignal from ensemble
    entry_price: float,
    atr: float = 0.0
) -> str:
    """
    Helper to record signals from the ML pipeline.
    Integrates with fusion/ensemble.py output.
    """
    return await signal_tracker.record_signal(
        symbol=symbol,
        signal_type=fused_signal.action,
        confidence=fused_signal.confidence,
        regime=fused_signal.regime,
        direction=fused_signal.direction,
        signal_strength=fused_signal.signal_strength,
        entry_price=entry_price,
        atr=atr,
        agent_signals={
            name: sig.signal_strength 
            for name, sig in fused_signal.agent_signals.items()
        },
        agreement_score=fused_signal.agreement_score
    )

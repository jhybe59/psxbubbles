"""
Signal Throttler
Controls signal frequency to prevent overtrading.

Limits:
- One signal per symbol per time window
- Cooldown after signals
- Maximum signals per session
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Optional
import structlog

logger = structlog.get_logger()


@dataclass
class ThrottleConfig:
    """Throttle configuration."""
    # Minimum seconds between signals for same symbol
    min_interval_seconds: float = 30.0
    
    # Cooldown after trade signal
    post_signal_cooldown_seconds: float = 60.0
    
    # Maximum signals per symbol per session
    max_signals_per_symbol: int = 20
    
    # Maximum total signals per session
    max_total_signals: int = 100
    
    # Session duration (for resets)
    session_duration_hours: float = 6.0


class SignalThrottler:
    """
    Throttles signal frequency to prevent overtrading.
    """
    
    def __init__(self, config: Optional[ThrottleConfig] = None):
        self.config = config or ThrottleConfig()
        
        # Track last signal time per symbol
        self.last_signal_time: Dict[str, datetime] = {}
        
        # Track signal counts
        self.signal_counts: Dict[str, int] = {}
        self.total_signals = 0
        
        # Session tracking
        self.session_start = datetime.now()
    
    def can_emit(self, symbol: str) -> tuple[bool, str]:
        """
        Check if a new signal can be emitted for symbol.
        
        Returns:
            (allowed: bool, reason: str)
        """
        now = datetime.now()
        
        # Check session reset
        session_duration = (now - self.session_start).total_seconds() / 3600
        if session_duration > self.config.session_duration_hours:
            self._reset_session()
        
        # Check max total signals
        if self.total_signals >= self.config.max_total_signals:
            return False, "max_total_signals"
        
        # Check max signals per symbol
        if self.signal_counts.get(symbol, 0) >= self.config.max_signals_per_symbol:
            return False, "max_symbol_signals"
        
        # Check minimum interval
        last_time = self.last_signal_time.get(symbol)
        if last_time:
            elapsed = (now - last_time).total_seconds()
            if elapsed < self.config.min_interval_seconds:
                return False, f"throttled ({self.config.min_interval_seconds - elapsed:.0f}s remaining)"
        
        return True, "allowed"
    
    def record_signal(self, symbol: str) -> None:
        """Record that a signal was emitted."""
        now = datetime.now()
        
        self.last_signal_time[symbol] = now
        self.signal_counts[symbol] = self.signal_counts.get(symbol, 0) + 1
        self.total_signals += 1
        
        logger.debug("signal_recorded", 
                     symbol=symbol, 
                     count=self.signal_counts[symbol])
    
    def apply_cooldown(self, symbol: str) -> None:
        """Apply post-signal cooldown."""
        # Set last signal time to future to enforce cooldown
        cooldown_until = datetime.now() + timedelta(
            seconds=self.config.post_signal_cooldown_seconds
        )
        self.last_signal_time[symbol] = cooldown_until
    
    def _reset_session(self) -> None:
        """Reset for new session."""
        self.last_signal_time.clear()
        self.signal_counts.clear()
        self.total_signals = 0
        self.session_start = datetime.now()
        logger.info("throttler_session_reset")
    
    def get_stats(self) -> dict:
        """Get throttle statistics."""
        return {
            'total_signals': self.total_signals,
            'signal_counts': dict(self.signal_counts),
            'session_duration_hours': (datetime.now() - self.session_start).total_seconds() / 3600
        }
    
    def get_time_until_allowed(self, symbol: str) -> float:
        """Get seconds until next signal is allowed for symbol."""
        last_time = self.last_signal_time.get(symbol)
        if not last_time:
            return 0
        
        elapsed = (datetime.now() - last_time).total_seconds()
        remaining = self.config.min_interval_seconds - elapsed
        return max(0, remaining)


# Global instance
signal_throttler = SignalThrottler()

"""
Safety Systems
Emergency controls and circuit breakers.

Features:
- Circuit breaker (auto-disable on errors)
- Kill switch (manual emergency stop)
- Model rollback
- Signal freeze
- Auto-disable unstable models
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional, Callable
from dataclasses import dataclass
from enum import Enum
from collections import deque
import structlog

logger = structlog.get_logger()


class SystemState(Enum):
    """System operational state."""
    RUNNING = "running"
    DEGRADED = "degraded"
    STOPPED = "stopped"
    FROZEN = "frozen"


@dataclass
class CircuitState:
    """State of a circuit breaker."""
    name: str
    state: str  # 'closed', 'open', 'half-open'
    failure_count: int
    last_failure: Optional[datetime]
    opened_at: Optional[datetime]
    
    def is_open(self) -> bool:
        return self.state == 'open'


class CircuitBreaker:
    """
    Circuit breaker pattern for error handling.
    Opens circuit after threshold failures, auto-resets after timeout.
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        reset_timeout_seconds: int = 60
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.reset_timeout = timedelta(seconds=reset_timeout_seconds)
        
        self.state = CircuitState(
            name=name,
            state='closed',
            failure_count=0,
            last_failure=None,
            opened_at=None
        )
        
        self.total_calls = 0
        self.total_failures = 0
    
    def can_execute(self) -> bool:
        """Check if circuit allows execution."""
        if self.state.state == 'closed':
            return True
        
        if self.state.state == 'open':
            # Check if timeout has passed
            if self.state.opened_at:
                if datetime.now() - self.state.opened_at > self.reset_timeout:
                    self.state.state = 'half-open'
                    logger.info("circuit_half_open", circuit=self.name)
                    return True
            return False
        
        if self.state.state == 'half-open':
            return True
        
        return False
    
    def record_success(self) -> None:
        """Record successful call."""
        self.total_calls += 1
        
        if self.state.state == 'half-open':
            # Success in half-open state closes circuit
            self.state.state = 'closed'
            self.state.failure_count = 0
            logger.info("circuit_closed", circuit=self.name)
    
    def record_failure(self) -> None:
        """Record failed call."""
        self.total_calls += 1
        self.total_failures += 1
        self.state.failure_count += 1
        self.state.last_failure = datetime.now()
        
        if self.state.state == 'half-open':
            # Failure in half-open reopens
            self._open()
        elif self.state.failure_count >= self.failure_threshold:
            self._open()
    
    def _open(self) -> None:
        """Open the circuit."""
        self.state.state = 'open'
        self.state.opened_at = datetime.now()
        logger.warning("circuit_opened", 
                      circuit=self.name,
                      failures=self.state.failure_count)
    
    def force_open(self) -> None:
        """Manually open circuit."""
        self._open()
    
    def force_close(self) -> None:
        """Manually close circuit."""
        self.state.state = 'closed'
        self.state.failure_count = 0
        logger.info("circuit_force_closed", circuit=self.name)
    
    def get_status(self) -> dict:
        """Get circuit status."""
        return {
            'name': self.name,
            'state': self.state.state,
            'failure_count': self.state.failure_count,
            'total_calls': self.total_calls,
            'total_failures': self.total_failures,
            'error_rate': round(self.total_failures / max(1, self.total_calls), 3)
        }


class KillSwitch:
    """
    Emergency kill switch for the trading system.
    Stops all signal generation when activated.
    """
    
    def __init__(self):
        self.activated = False
        self.activated_at: Optional[datetime] = None
        self.activated_by: Optional[str] = None
        self.reason: Optional[str] = None
        
        # Auto-kill conditions
        self.auto_kill_enabled = True
        self.max_hourly_signals = 500
        self.max_hourly_losses = 10
        
        # Tracking
        self.hourly_signals = 0
        self.hourly_losses = 0
        self.last_reset = datetime.now()
    
    def activate(self, reason: str, by: str = "system") -> None:
        """Activate kill switch."""
        self.activated = True
        self.activated_at = datetime.now()
        self.activated_by = by
        self.reason = reason
        logger.critical("kill_switch_activated", reason=reason, by=by)
    
    def deactivate(self, by: str = "system") -> None:
        """Deactivate kill switch."""
        self.activated = False
        self.activated_at = None
        logger.info("kill_switch_deactivated", by=by)
    
    def is_active(self) -> bool:
        """Check if kill switch is active."""
        return self.activated
    
    def record_signal(self) -> None:
        """Record a signal for rate limiting."""
        self._check_hour_reset()
        self.hourly_signals += 1
        
        if self.auto_kill_enabled and self.hourly_signals > self.max_hourly_signals:
            self.activate("hourly_signal_limit_exceeded", "auto")
    
    def record_loss(self) -> None:
        """Record a loss for protection."""
        self._check_hour_reset()
        self.hourly_losses += 1
        
        if self.auto_kill_enabled and self.hourly_losses > self.max_hourly_losses:
            self.activate("hourly_loss_limit_exceeded", "auto")
    
    def _check_hour_reset(self) -> None:
        """Reset hourly counters."""
        if datetime.now() - self.last_reset > timedelta(hours=1):
            self.hourly_signals = 0
            self.hourly_losses = 0
            self.last_reset = datetime.now()
    
    def get_status(self) -> dict:
        """Get kill switch status."""
        return {
            'activated': self.activated,
            'activated_at': self.activated_at.isoformat() if self.activated_at else None,
            'reason': self.reason,
            'hourly_signals': self.hourly_signals,
            'hourly_losses': self.hourly_losses,
            'auto_kill_enabled': self.auto_kill_enabled
        }


class SignalFreeze:
    """
    Temporarily freeze signal generation.
    Used during high uncertainty or manual intervention.
    """
    
    def __init__(self):
        self.frozen = False
        self.frozen_at: Optional[datetime] = None
        self.unfreeze_at: Optional[datetime] = None
        self.reason: Optional[str] = None
        
        # Symbol-specific freezes
        self.frozen_symbols: Dict[str, datetime] = {}
    
    def freeze(self, duration_minutes: int = 30, reason: str = "") -> None:
        """Freeze all signals."""
        self.frozen = True
        self.frozen_at = datetime.now()
        self.unfreeze_at = datetime.now() + timedelta(minutes=duration_minutes)
        self.reason = reason
        logger.warning("signals_frozen", duration=duration_minutes, reason=reason)
    
    def freeze_symbol(self, symbol: str, duration_minutes: int = 30) -> None:
        """Freeze signals for a specific symbol."""
        self.frozen_symbols[symbol] = datetime.now() + timedelta(minutes=duration_minutes)
        logger.info("symbol_frozen", symbol=symbol, duration=duration_minutes)
    
    def unfreeze(self) -> None:
        """Unfreeze all signals."""
        self.frozen = False
        self.frozen_at = None
        self.unfreeze_at = None
        self.reason = None
        logger.info("signals_unfrozen")
    
    def is_frozen(self, symbol: str = "") -> bool:
        """Check if signals are frozen."""
        # Check global freeze
        if self.frozen:
            if self.unfreeze_at and datetime.now() > self.unfreeze_at:
                self.unfreeze()
                return False
            return True
        
        # Check symbol freeze
        if symbol in self.frozen_symbols:
            if datetime.now() > self.frozen_symbols[symbol]:
                del self.frozen_symbols[symbol]
                return False
            return True
        
        return False
    
    def get_status(self) -> dict:
        """Get freeze status."""
        return {
            'frozen': self.frozen,
            'frozen_at': self.frozen_at.isoformat() if self.frozen_at else None,
            'unfreeze_at': self.unfreeze_at.isoformat() if self.unfreeze_at else None,
            'reason': self.reason,
            'frozen_symbols': list(self.frozen_symbols.keys())
        }


class SafetyController:
    """
    Central safety controller managing all safety systems.
    """
    
    def __init__(self):
        self.state = SystemState.RUNNING
        
        # Components
        self.circuit_breakers: Dict[str, CircuitBreaker] = {
            'inference': CircuitBreaker('inference', failure_threshold=5),
            'redis': CircuitBreaker('redis', failure_threshold=3),
            'questdb': CircuitBreaker('questdb', failure_threshold=3),
        }
        
        self.kill_switch = KillSwitch()
        self.signal_freeze = SignalFreeze()
        
        # Event handlers
        self.on_state_change: Optional[Callable] = None
    
    def can_generate_signals(self, symbol: str = "") -> bool:
        """Check if signal generation is allowed."""
        if self.state == SystemState.STOPPED:
            return False
        
        if self.kill_switch.is_active():
            return False
        
        if self.signal_freeze.is_frozen(symbol):
            return False
        
        if self.circuit_breakers['inference'].state.is_open():
            return False
        
        return True
    
    def emergency_stop(self, reason: str) -> None:
        """Emergency stop all operations."""
        self.state = SystemState.STOPPED
        self.kill_switch.activate(reason, "emergency")
        
        for cb in self.circuit_breakers.values():
            cb.force_open()
        
        logger.critical("emergency_stop", reason=reason)
        
        if self.on_state_change:
            self.on_state_change(self.state)
    
    def resume(self) -> None:
        """Resume operations."""
        self.state = SystemState.RUNNING
        self.kill_switch.deactivate("manual")
        
        for cb in self.circuit_breakers.values():
            cb.force_close()
        
        self.signal_freeze.unfreeze()
        
        logger.info("operations_resumed")
        
        if self.on_state_change:
            self.on_state_change(self.state)
    
    def get_status(self) -> dict:
        """Get full safety status."""
        return {
            'state': self.state.value,
            'can_generate_signals': self.can_generate_signals(),
            'kill_switch': self.kill_switch.get_status(),
            'signal_freeze': self.signal_freeze.get_status(),
            'circuit_breakers': {
                name: cb.get_status()
                for name, cb in self.circuit_breakers.items()
            }
        }


# Global instances
safety_controller = SafetyController()
kill_switch = safety_controller.kill_switch
signal_freeze = safety_controller.signal_freeze

"""
System Health Monitor
Monitors system stability and resource usage.

Tracks:
- Memory usage
- CPU usage
- Queue lengths
- Connection health
- Error rates
- Signal flow
"""
import asyncio
import os
import time
import psutil
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from collections import deque
import structlog

logger = structlog.get_logger()


@dataclass
class HealthMetrics:
    """Point-in-time health metrics."""
    timestamp: datetime
    
    # System
    memory_mb: float
    memory_pct: float
    cpu_pct: float
    
    # Pipeline
    ticks_per_sec: float
    signals_per_min: float
    error_rate: float
    
    # Queues
    redis_queue_size: int = 0
    pending_inferences: int = 0
    
    # Connections
    redis_connected: bool = True
    questdb_connected: bool = True


@dataclass
class HealthThresholds:
    """Thresholds for health checks."""
    max_memory_mb: float = 2048
    max_memory_pct: float = 80
    max_cpu_pct: float = 80
    max_error_rate: float = 0.1
    max_queue_size: int = 1000
    min_ticks_per_sec: float = 0.1
    
    # Alert after N consecutive violations
    violation_threshold: int = 3


class SystemHealthMonitor:
    """
    Monitors system health and stability.
    """
    
    def __init__(
        self,
        thresholds: Optional[HealthThresholds] = None,
        history_size: int = 1000
    ):
        self.thresholds = thresholds or HealthThresholds()
        self.history: deque = deque(maxlen=history_size)
        
        # Counters
        self.tick_count = 0
        self.signal_count = 0
        self.error_count = 0
        self.total_count = 0
        
        # Timing
        self.start_time = datetime.now()
        self.last_check = datetime.now()
        self.last_tick_time = datetime.now()
        
        # Violation tracking
        self.violations: Dict[str, int] = {}
        
        # Running state
        self.running = False
        self._monitor_task = None
    
    def record_tick(self) -> None:
        """Record incoming tick."""
        self.tick_count += 1
        self.total_count += 1
        self.last_tick_time = datetime.now()
    
    def record_signal(self) -> None:
        """Record emitted signal."""
        self.signal_count += 1
    
    def record_error(self) -> None:
        """Record error."""
        self.error_count += 1
    
    def check_health(self) -> HealthMetrics:
        """Perform health check."""
        now = datetime.now()
        elapsed = (now - self.last_check).total_seconds()
        
        # Get system metrics
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        
        metrics = HealthMetrics(
            timestamp=now,
            memory_mb=memory_info.rss / 1024 / 1024,
            memory_pct=process.memory_percent(),
            cpu_pct=process.cpu_percent(),
            ticks_per_sec=self.tick_count / max(1, elapsed),
            signals_per_min=self.signal_count / max(0.0167, elapsed / 60),
            error_rate=self.error_count / max(1, self.total_count)
        )
        
        # Reset counters for next interval
        self.tick_count = 0
        self.signal_count = 0
        self.error_count = 0
        self.last_check = now
        
        # Store in history
        self.history.append(metrics)
        
        # Check thresholds
        self._check_thresholds(metrics)
        
        return metrics
    
    def _check_thresholds(self, metrics: HealthMetrics) -> None:
        """Check metrics against thresholds."""
        checks = {
            'memory_mb': (metrics.memory_mb, self.thresholds.max_memory_mb, 'lt'),
            'memory_pct': (metrics.memory_pct, self.thresholds.max_memory_pct, 'lt'),
            'cpu_pct': (metrics.cpu_pct, self.thresholds.max_cpu_pct, 'lt'),
            'error_rate': (metrics.error_rate, self.thresholds.max_error_rate, 'lt'),
        }
        
        for name, (value, threshold, op) in checks.items():
            violated = value > threshold if op == 'lt' else value < threshold
            
            if violated:
                self.violations[name] = self.violations.get(name, 0) + 1
                
                if self.violations[name] >= self.thresholds.violation_threshold:
                    logger.warning("health_threshold_exceeded",
                                  metric=name,
                                  value=round(value, 2),
                                  threshold=threshold,
                                  violations=self.violations[name])
            else:
                self.violations[name] = 0
    
    def get_status(self) -> dict:
        """Get current health status."""
        if not self.history:
            return {'status': 'no_data'}
        
        latest = self.history[-1]
        
        # Determine overall status
        status = 'healthy'
        alerts = []
        
        if latest.memory_pct > self.thresholds.max_memory_pct:
            status = 'warning'
            alerts.append('high_memory')
        
        if latest.cpu_pct > self.thresholds.max_cpu_pct:
            status = 'warning'
            alerts.append('high_cpu')
        
        if latest.error_rate > self.thresholds.max_error_rate:
            status = 'critical'
            alerts.append('high_error_rate')
        
        time_since_tick = (datetime.now() - self.last_tick_time).total_seconds()
        if time_since_tick > 60:
            status = 'warning'
            alerts.append('no_recent_ticks')
        
        return {
            'status': status,
            'alerts': alerts,
            'uptime_seconds': (datetime.now() - self.start_time).total_seconds(),
            'metrics': {
                'memory_mb': round(latest.memory_mb, 1),
                'memory_pct': round(latest.memory_pct, 1),
                'cpu_pct': round(latest.cpu_pct, 1),
                'ticks_per_sec': round(latest.ticks_per_sec, 2),
                'error_rate': round(latest.error_rate, 4)
            },
            'violations': dict(self.violations)
        }
    
    def get_history(self, minutes: int = 60) -> List[dict]:
        """Get metrics history."""
        cutoff = datetime.now() - timedelta(minutes=minutes)
        
        return [
            {
                'timestamp': m.timestamp.isoformat(),
                'memory_mb': round(m.memory_mb, 1),
                'cpu_pct': round(m.cpu_pct, 1),
                'ticks_per_sec': round(m.ticks_per_sec, 2),
                'error_rate': round(m.error_rate, 4)
            }
            for m in self.history
            if m.timestamp > cutoff
        ]
    
    async def start_monitoring(self, interval_seconds: int = 30) -> None:
        """Start background monitoring."""
        self.running = True
        logger.info("health_monitor_started", interval=interval_seconds)
        
        while self.running:
            try:
                self.check_health()
            except Exception as e:
                logger.error("health_check_error", error=str(e))
            
            await asyncio.sleep(interval_seconds)
    
    def stop_monitoring(self) -> None:
        """Stop monitoring."""
        self.running = False
        logger.info("health_monitor_stopped")


class StabilityTest:
    """
    Long-running stability test.
    """
    
    def __init__(
        self,
        duration_hours: float = 1.0,
        check_interval_seconds: int = 60
    ):
        self.duration_hours = duration_hours
        self.check_interval = check_interval_seconds
        self.monitor = SystemHealthMonitor()
        
        self.start_time = None
        self.end_time = None
        self.checkpoints: List[dict] = []
        self.issues: List[dict] = []
    
    async def run(self) -> dict:
        """Run stability test."""
        logger.info("stability_test_starting", duration_hours=self.duration_hours)
        
        self.start_time = datetime.now()
        target_end = self.start_time + timedelta(hours=self.duration_hours)
        
        initial_memory = psutil.Process().memory_info().rss / 1024 / 1024
        
        while datetime.now() < target_end:
            try:
                # Check health
                metrics = self.monitor.check_health()
                
                checkpoint = {
                    'timestamp': metrics.timestamp.isoformat(),
                    'memory_mb': metrics.memory_mb,
                    'cpu_pct': metrics.cpu_pct,
                    'elapsed_minutes': (datetime.now() - self.start_time).total_seconds() / 60
                }
                self.checkpoints.append(checkpoint)
                
                # Check for issues
                if metrics.memory_mb > initial_memory * 2:
                    self.issues.append({
                        'type': 'memory_growth',
                        'timestamp': metrics.timestamp.isoformat(),
                        'initial_mb': initial_memory,
                        'current_mb': metrics.memory_mb
                    })
                
                if metrics.error_rate > 0.05:
                    self.issues.append({
                        'type': 'high_error_rate',
                        'timestamp': metrics.timestamp.isoformat(),
                        'rate': metrics.error_rate
                    })
                
            except Exception as e:
                self.issues.append({
                    'type': 'check_failed',
                    'timestamp': datetime.now().isoformat(),
                    'error': str(e)
                })
            
            await asyncio.sleep(self.check_interval)
        
        self.end_time = datetime.now()
        
        return self._generate_report()
    
    def _generate_report(self) -> dict:
        """Generate stability report."""
        final_memory = psutil.Process().memory_info().rss / 1024 / 1024
        initial_memory = self.checkpoints[0]['memory_mb'] if self.checkpoints else 0
        
        # Calculate averages
        if self.checkpoints:
            avg_cpu = sum(c['cpu_pct'] for c in self.checkpoints) / len(self.checkpoints)
            max_memory = max(c['memory_mb'] for c in self.checkpoints)
        else:
            avg_cpu = 0
            max_memory = 0
        
        return {
            'status': 'passed' if not self.issues else 'issues_found',
            'duration_hours': self.duration_hours,
            'actual_duration_hours': (self.end_time - self.start_time).total_seconds() / 3600,
            'checkpoints': len(self.checkpoints),
            'issues': self.issues,
            'summary': {
                'initial_memory_mb': round(initial_memory, 1),
                'final_memory_mb': round(final_memory, 1),
                'memory_growth_mb': round(final_memory - initial_memory, 1),
                'memory_growth_pct': round((final_memory / max(1, initial_memory) - 1) * 100, 1),
                'max_memory_mb': round(max_memory, 1),
                'avg_cpu_pct': round(avg_cpu, 1)
            }
        }


# Global monitor instance
health_monitor = SystemHealthMonitor()

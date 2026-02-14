"""
Latency Profiler
Measures latency at each stage of the inference pipeline.

Stages:
1. Tick Ingest
2. Bar Close
3. Feature Compute
4. Agent Analysis
5. Fusion
6. Gating
7. Redis Publish
8. Total E2E
"""
import time
import asyncio
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from collections import defaultdict
import statistics
import structlog

logger = structlog.get_logger()


@dataclass
class LatencyMeasurement:
    """Single latency measurement."""
    stage: str
    start_ns: int
    end_ns: int
    symbol: str = ""
    
    @property
    def duration_ms(self) -> float:
        return (self.end_ns - self.start_ns) / 1_000_000


@dataclass
class LatencyStats:
    """Statistics for a stage."""
    stage: str
    count: int
    mean_ms: float
    median_ms: float
    p95_ms: float
    p99_ms: float
    max_ms: float
    min_ms: float


class LatencyProfiler:
    """
    Profiles latency across the inference pipeline.
    
    Usage:
        with profiler.measure("feature_compute", "LUCK"):
            # do work
            
        # Or manual:
        profiler.start("stage_name")
        # work
        profiler.end("stage_name")
    """
    
    # Target latencies (ms)
    TARGETS = {
        'tick_ingest': 5,
        'bar_aggregate': 10,
        'feature_compute': 10,
        'agent_analyze': 15,
        'ensemble_fuse': 5,
        'confidence_gate': 2,
        'risk_filter': 2,
        'throttle_check': 1,
        'redis_publish': 5,
        'total_e2e': 60
    }
    
    def __init__(self, max_history: int = 10000):
        self.max_history = max_history
        self.measurements: Dict[str, List[LatencyMeasurement]] = defaultdict(list)
        self._active: Dict[str, int] = {}  # stage -> start_ns
        self._active_symbol: Dict[str, str] = {}
    
    def start(self, stage: str, symbol: str = "") -> None:
        """Start timing a stage."""
        self._active[stage] = time.perf_counter_ns()
        self._active_symbol[stage] = symbol
    
    def end(self, stage: str) -> float:
        """End timing a stage, return duration in ms."""
        end_ns = time.perf_counter_ns()
        
        if stage not in self._active:
            logger.warning("latency_end_without_start", stage=stage)
            return 0
        
        start_ns = self._active.pop(stage)
        symbol = self._active_symbol.pop(stage, "")
        
        measurement = LatencyMeasurement(
            stage=stage,
            start_ns=start_ns,
            end_ns=end_ns,
            symbol=symbol
        )
        
        self._record(measurement)
        return measurement.duration_ms
    
    def measure(self, stage: str, symbol: str = ""):
        """Context manager for measuring a stage."""
        return LatencyContext(self, stage, symbol)
    
    def _record(self, measurement: LatencyMeasurement) -> None:
        """Record a measurement."""
        self.measurements[measurement.stage].append(measurement)
        
        # Trim if too long
        if len(self.measurements[measurement.stage]) > self.max_history:
            self.measurements[measurement.stage] = \
                self.measurements[measurement.stage][-self.max_history:]
        
        # Log if over target
        target = self.TARGETS.get(measurement.stage)
        if target and measurement.duration_ms > target * 1.5:
            logger.warning("latency_high",
                          stage=measurement.stage,
                          duration_ms=round(measurement.duration_ms, 2),
                          target_ms=target)
    
    def get_stats(self, stage: str) -> Optional[LatencyStats]:
        """Get statistics for a stage."""
        if stage not in self.measurements or not self.measurements[stage]:
            return None
        
        durations = [m.duration_ms for m in self.measurements[stage]]
        
        return LatencyStats(
            stage=stage,
            count=len(durations),
            mean_ms=round(statistics.mean(durations), 2),
            median_ms=round(statistics.median(durations), 2),
            p95_ms=round(self._percentile(durations, 95), 2),
            p99_ms=round(self._percentile(durations, 99), 2),
            max_ms=round(max(durations), 2),
            min_ms=round(min(durations), 2)
        )
    
    def get_all_stats(self) -> Dict[str, LatencyStats]:
        """Get stats for all stages."""
        return {
            stage: self.get_stats(stage)
            for stage in self.measurements
            if self.get_stats(stage)
        }
    
    def get_summary(self) -> dict:
        """Get summary report."""
        stats = self.get_all_stats()
        
        summary = {
            'stages': {},
            'violations': []
        }
        
        for stage, stat in stats.items():
            target = self.TARGETS.get(stage)
            
            summary['stages'][stage] = {
                'mean_ms': stat.mean_ms,
                'p95_ms': stat.p95_ms,
                'target_ms': target,
                'within_target': stat.p95_ms <= target if target else True
            }
            
            if target and stat.p95_ms > target:
                summary['violations'].append({
                    'stage': stage,
                    'p95_ms': stat.p95_ms,
                    'target_ms': target,
                    'violation_pct': round((stat.p95_ms / target - 1) * 100, 1)
                })
        
        return summary
    
    def _percentile(self, data: List[float], p: float) -> float:
        """Calculate percentile."""
        if not data:
            return 0
        sorted_data = sorted(data)
        k = (len(sorted_data) - 1) * p / 100
        f = int(k)
        c = f + 1 if f + 1 < len(sorted_data) else f
        return sorted_data[f] + (sorted_data[c] - sorted_data[f]) * (k - f)
    
    def reset(self) -> None:
        """Reset all measurements."""
        self.measurements.clear()
        self._active.clear()
        self._active_symbol.clear()


class LatencyContext:
    """Context manager for latency measurement."""
    
    def __init__(self, profiler: LatencyProfiler, stage: str, symbol: str):
        self.profiler = profiler
        self.stage = stage
        self.symbol = symbol
    
    def __enter__(self):
        self.profiler.start(self.stage, self.symbol)
        return self
    
    def __exit__(self, *args):
        self.profiler.end(self.stage)


# Global profiler
latency_profiler = LatencyProfiler()

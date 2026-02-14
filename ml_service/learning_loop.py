"""
Learning Loop
The SELF-IMPROVEMENT engine of the trading system.

This makes the system adaptive and self-correcting:
Signal → Result → Feedback → Learning → Better Decisions

Features:
- Rolling performance monitoring
- Drift detection integration
- Auto-retraining triggers
- Weight adjustment by profitability
- Model versioning
"""
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Callable, Any
from dataclasses import dataclass
from collections import defaultdict
import structlog
import json

from signal_tracker import signal_tracker, SignalStats
from profit_validator import profit_validator
from drift_detection import concept_drift_detector, drift_detector

logger = structlog.get_logger()


@dataclass
class PerformanceAlert:
    """Alert for performance degradation."""
    alert_type: str           # 'accuracy_drop', 'edge_loss', 'drift_detected'
    signal_type: str
    current_value: float
    threshold: float
    timestamp: datetime
    severity: str             # 'warning', 'critical'
    message: str


@dataclass
class LearningEvent:
    """Record of a learning/retraining event."""
    event_type: str           # 'weight_adjust', 'retrain_trigger', 'drift_response'
    timestamp: datetime
    trigger_reason: str
    old_values: Dict[str, float]
    new_values: Dict[str, float]
    affected_models: List[str]


class PerformanceMonitor:
    """
    Monitors rolling performance metrics per signal type.
    
    Watches for:
    - Accuracy drops
    - Edge deterioration
    - Profit factor decline
    """
    
    def __init__(
        self,
        accuracy_threshold: float = 0.45,    # Trigger below 45%
        edge_threshold: float = -0.01,       # Trigger if edge goes negative
        profit_factor_threshold: float = 0.8 # Trigger below 0.8
    ):
        self.accuracy_threshold = accuracy_threshold
        self.edge_threshold = edge_threshold
        self.profit_factor_threshold = profit_factor_threshold
        
        # Historical performance tracking
        self.performance_history: Dict[str, List[Dict]] = defaultdict(list)
        self.max_history_per_type = 100
        
        # Alert tracking
        self.active_alerts: List[PerformanceAlert] = []
        
        logger.info("performance_monitor_initialized",
                   accuracy_threshold=accuracy_threshold,
                   edge_threshold=edge_threshold)
    
    def check_performance(self) -> List[PerformanceAlert]:
        """
        Check current performance against thresholds.
        Returns list of alerts if issues detected.
        """
        alerts = []
        
        # Get current stats from signal tracker
        all_stats = signal_tracker.get_stats()
        
        for signal_type, stats in all_stats.items():
            if stats.completed_signals < 20:
                continue  # Not enough data
            
            # Check accuracy
            if stats.accuracy_rate < self.accuracy_threshold:
                alerts.append(PerformanceAlert(
                    alert_type='accuracy_drop',
                    signal_type=signal_type,
                    current_value=stats.accuracy_rate,
                    threshold=self.accuracy_threshold,
                    timestamp=datetime.now(),
                    severity='critical' if stats.accuracy_rate < 0.4 else 'warning',
                    message=f"{signal_type} accuracy dropped to {stats.accuracy_rate:.1%}"
                ))
            
            # Check edge
            edge = profit_validator.get_signal_edge(signal_type)
            if edge < self.edge_threshold:
                alerts.append(PerformanceAlert(
                    alert_type='edge_loss',
                    signal_type=signal_type,
                    current_value=edge,
                    threshold=self.edge_threshold,
                    timestamp=datetime.now(),
                    severity='critical',
                    message=f"{signal_type} edge is negative ({edge:.2%})"
                ))
            
            # Check profit factor
            pf = profit_validator.get_profit_factor(signal_type)
            if pf < self.profit_factor_threshold:
                alerts.append(PerformanceAlert(
                    alert_type='profit_factor_drop',
                    signal_type=signal_type,
                    current_value=pf,
                    threshold=self.profit_factor_threshold,
                    timestamp=datetime.now(),
                    severity='warning',
                    message=f"{signal_type} profit factor low ({pf:.2f})"
                ))
            
            # Record to history
            self.performance_history[signal_type].append({
                'timestamp': datetime.now().isoformat(),
                'accuracy': stats.accuracy_rate,
                'edge': edge,
                'profit_factor': pf,
                'completed_signals': stats.completed_signals
            })
            
            # Trim history
            if len(self.performance_history[signal_type]) > self.max_history_per_type:
                self.performance_history[signal_type].pop(0)
        
        self.active_alerts = alerts
        return alerts


class LearningLoop:
    """
    Main learning loop that ties everything together.
    
    Pipeline:
    1. Monitor performance
    2. Detect degradation
    3. Trigger appropriate response (weight adjust or retrain)
    4. Log events
    """
    
    def __init__(
        self,
        check_interval_seconds: int = 300,  # Check every 5 min
        retrain_callback: Optional[Callable] = None
    ):
        self.check_interval = check_interval_seconds
        self.retrain_callback = retrain_callback
        
        self.monitor = PerformanceMonitor()
        
        # Learning events log
        self.events: List[LearningEvent] = []
        self.max_events = 1000
        
        # Ensemble weights (can be adjusted dynamically)
        self.current_weights: Dict[str, float] = {
            'volume': 0.20,
            'volatility': 0.15,
            'momentum': 0.25,
            'flow': 0.20,
            'regime': 0.20
        }
        
        # Running state
        self._running = False
        self._task: Optional[asyncio.Task] = None
        
        # Stats
        self.stats = {
            'checks_performed': 0,
            'alerts_generated': 0,
            'retrains_triggered': 0,
            'weight_adjustments': 0
        }
        
        logger.info("learning_loop_initialized",
                   check_interval=check_interval_seconds)
    
    async def start(self) -> None:
        """Start the continuous learning loop."""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._run())
        logger.info("learning_loop_started")
    
    async def stop(self) -> None:
        """Stop the learning loop."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("learning_loop_stopped")
    
    async def _run(self) -> None:
        """Main loop."""
        while self._running:
            try:
                await self._check_and_learn()
                await asyncio.sleep(self.check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("learning_loop_error", error=str(e))
                await asyncio.sleep(60)  # Wait before retry
    
    async def _check_and_learn(self) -> None:
        """Perform one cycle of checking and learning."""
        self.stats['checks_performed'] += 1
        
        # 1. Check performance
        alerts = self.monitor.check_performance()
        self.stats['alerts_generated'] += len(alerts)
        
        # 2. Check for drift
        drift_status = self._check_drift()
        
        # 3. Respond to issues
        if alerts or drift_status['drift_detected']:
            await self._respond_to_issues(alerts, drift_status)
        
        logger.debug("learning_check_complete",
                    alerts=len(alerts),
                    drift=drift_status['drift_detected'])
    
    def _check_drift(self) -> Dict[str, Any]:
        """Check for concept and data drift."""
        return {
            'drift_detected': concept_drift_detector.requires_retraining(),
            'accuracy': concept_drift_detector.get_current_accuracy(),
            'drift_scores': drift_detector.get_current_scores()
        }
    
    async def _respond_to_issues(
        self, 
        alerts: List[PerformanceAlert],
        drift_status: Dict[str, Any]
    ) -> None:
        """Respond to detected issues."""
        
        critical_alerts = [a for a in alerts if a.severity == 'critical']
        
        if drift_status['drift_detected'] or len(critical_alerts) >= 2:
            # Severe degradation - trigger retrain
            await self._trigger_retrain(alerts, drift_status)
        elif alerts:
            # Minor issues - adjust weights
            self._adjust_weights(alerts)
    
    async def _trigger_retrain(
        self,
        alerts: List[PerformanceAlert],
        drift_status: Dict[str, Any]
    ) -> None:
        """Trigger model retraining."""
        self.stats['retrains_triggered'] += 1
        
        trigger_reason = "drift" if drift_status['drift_detected'] else "performance_degradation"
        affected_types = list(set(a.signal_type for a in alerts))
        
        event = LearningEvent(
            event_type='retrain_trigger',
            timestamp=datetime.now(),
            trigger_reason=trigger_reason,
            old_values={'accuracy': drift_status['accuracy']},
            new_values={},  # Filled after retrain
            affected_models=affected_types
        )
        
        self._record_event(event)
        
        logger.warning("retrain_triggered",
                      reason=trigger_reason,
                      affected=affected_types)
        
        # Call retrain callback if provided
        if self.retrain_callback:
            try:
                await self.retrain_callback(affected_types)
            except Exception as e:
                logger.error("retrain_callback_failed", error=str(e))
    
    def _adjust_weights(self, alerts: List[PerformanceAlert]) -> None:
        """Adjust ensemble weights based on performance."""
        self.stats['weight_adjustments'] += 1
        
        old_weights = self.current_weights.copy()
        
        # Get performance by signal type
        for alert in alerts:
            signal_type = alert.signal_type
            
            # Find corresponding agent weight
            # Map signal types to agent names
            agent_map = {
                'buy': 'momentum',
                'strong_buy': 'momentum',
                'sell': 'momentum',
                'strong_sell': 'momentum',
                'pump': 'volume',
                'dump': 'volume'
            }
            
            agent = agent_map.get(signal_type)
            if agent and agent in self.current_weights:
                # Reduce weight for underperforming
                if alert.alert_type in ['accuracy_drop', 'edge_loss']:
                    self.current_weights[agent] *= 0.9
        
        # Renormalize weights
        total = sum(self.current_weights.values())
        if total > 0:
            self.current_weights = {
                k: v / total for k, v in self.current_weights.items()
            }
        
        event = LearningEvent(
            event_type='weight_adjust',
            timestamp=datetime.now(),
            trigger_reason='performance_degradation',
            old_values=old_weights,
            new_values=self.current_weights.copy(),
            affected_models=list(self.current_weights.keys())
        )
        
        self._record_event(event)
        
        logger.info("weights_adjusted",
                   old=old_weights,
                   new=self.current_weights)
    
    def _record_event(self, event: LearningEvent) -> None:
        """Record a learning event."""
        self.events.append(event)
        if len(self.events) > self.max_events:
            self.events.pop(0)
    
    # ==================== QUERIES ====================
    
    def get_current_weights(self) -> Dict[str, float]:
        """Get current ensemble weights."""
        return self.current_weights.copy()
    
    def get_performance_history(
        self, 
        signal_type: Optional[str] = None
    ) -> Dict[str, List[Dict]]:
        """Get performance history."""
        if signal_type:
            return {signal_type: self.monitor.performance_history.get(signal_type, [])}
        return dict(self.monitor.performance_history)
    
    def get_recent_events(self, n: int = 10) -> List[Dict]:
        """Get recent learning events."""
        return [
            {
                'event_type': e.event_type,
                'timestamp': e.timestamp.isoformat(),
                'trigger_reason': e.trigger_reason,
                'affected_models': e.affected_models
            }
            for e in self.events[-n:]
        ]
    
    def get_status(self) -> Dict[str, Any]:
        """Get learning loop status."""
        return {
            'running': self._running,
            'stats': self.stats,
            'active_alerts': len(self.monitor.active_alerts),
            'current_weights': self.current_weights,
            'recent_events': len(self.events)
        }


# Singleton instance
learning_loop = LearningLoop()


# ==================== INTEGRATION ====================

async def start_learning() -> None:
    """Start the learning loop (called from main.py)."""
    await learning_loop.start()


async def stop_learning() -> None:
    """Stop the learning loop."""
    await learning_loop.stop()


def get_adaptive_weights() -> Dict[str, float]:
    """Get current adaptive weights for ensemble."""
    return learning_loop.get_current_weights()


def record_prediction_outcome(prediction: str, actual: str) -> bool:
    """
    Record a prediction outcome for drift detection.
    
    Returns True if drift detected.
    """
    return concept_drift_detector.record_outcome(prediction, actual)

"""
Prometheus Metrics Exporter
Exposes ML service metrics for monitoring.

Metrics:
- Inference latency
- Signal counts
- Confidence distribution
- Agent signals
- Regime state
- System health
"""
from prometheus_client import Counter, Histogram, Gauge, Info, REGISTRY
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from functools import wraps
import time


# ===========================================
# Inference Metrics
# ===========================================

INFERENCE_LATENCY = Histogram(
    'ml_inference_latency_seconds',
    'Time spent in inference',
    buckets=[0.01, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.5, 1.0]
)

INFERENCE_TOTAL = Counter(
    'ml_inference_total',
    'Total number of inferences',
    ['symbol', 'status']
)

# ===========================================
# Signal Metrics
# ===========================================

SIGNALS_TOTAL = Counter(
    'ml_signals_total',
    'Total number of signals generated',
    ['symbol', 'action', 'regime']
)

SIGNAL_CONFIDENCE = Gauge(
    'ml_signal_confidence',
    'Current signal confidence',
    ['symbol']
)

SIGNAL_STRENGTH = Gauge(
    'ml_signal_strength',
    'Current signal strength',
    ['symbol']
)

# ===========================================
# Agent Metrics
# ===========================================

AGENT_SIGNAL = Gauge(
    'ml_agent_signal',
    'Agent signal value',
    ['agent', 'symbol']
)

AGENT_CONFIDENCE = Gauge(
    'ml_agent_confidence',
    'Agent confidence value',
    ['agent', 'symbol']
)

AGENT_DISAGREEMENT = Gauge(
    'ml_agent_disagreement',
    'Agent disagreement score'
)

# ===========================================
# Regime Metrics
# ===========================================

CURRENT_REGIME = Gauge(
    'ml_current_regime',
    'Current market regime (encoded)',
    ['regime_name']
)

REGIME_CONFIDENCE = Gauge(
    'ml_regime_confidence',
    'Regime detection confidence'
)

REGIME_DURATION = Gauge(
    'ml_regime_duration_seconds',
    'Time in current regime'
)

# ===========================================
# Safety Metrics
# ===========================================

GATE_PASSED = Counter(
    'ml_confidence_gate_passed',
    'Signals that passed confidence gate',
    ['symbol']
)

GATE_BLOCKED = Counter(
    'ml_confidence_gate_blocked',
    'Signals blocked by confidence gate',
    ['symbol', 'reason']
)

THROTTLE_BLOCKED = Counter(
    'ml_throttle_blocked',
    'Signals blocked by throttler',
    ['symbol']
)

RISK_BLOCKED = Counter(
    'ml_risk_blocked',
    'Signals blocked by risk filter',
    ['symbol', 'reason']
)

# ===========================================
# Pipeline Metrics
# ===========================================

PIPELINE_STAGE_LATENCY = Histogram(
    'ml_pipeline_stage_latency_seconds',
    'Latency per pipeline stage',
    ['stage'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1]
)

TICKS_PROCESSED = Counter(
    'ml_ticks_processed_total',
    'Total ticks processed',
    ['symbol']
)

BARS_GENERATED = Counter(
    'ml_bars_generated_total',
    'Total bars generated',
    ['symbol', 'bar_type']
)

REDIS_QUEUE_SIZE = Gauge(
    'redis_stream_length',
    'Length of Redis inference queue'
)

# ===========================================
# Model Metrics
# ===========================================

MODEL_VERSION = Info(
    'ml_model_version',
    'Current model version info'
)

MODEL_PREDICTIONS = Counter(
    'ml_model_predictions_total',
    'Total predictions by model',
    ['model']
)


# ===========================================
# Phase 7.5: Trust & Validation Metrics
# ===========================================

GATES_PASSED = Gauge(
    'ml_gates_passed',
    'Number of validation gates passed (out of 7)'
)

AUTOMATION_ALLOWED = Gauge(
    'ml_automation_allowed',
    'Whether automation is allowed (1=yes, 0=no)'
)

PROFIT_FACTOR = Gauge(
    'ml_profit_factor',
    'Current profit factor'
)

WIN_RATE = Gauge(
    'ml_win_rate',
    'Current win rate'
)

DISCIPLINE_SCORE = Gauge(
    'ml_discipline_score',
    'Regime discipline score (0-1)'
)

VIOLATIONS_TOTAL = Counter(
    'ml_violations_total',
    'Total regime violations',
    ['violation_type', 'regime']
)

PAPER_TRADES_TOTAL = Counter(
    'ml_paper_trades_total',
    'Total paper trades logged',
    ['symbol', 'regime']
)

CUMULATIVE_PNL = Gauge(
    'ml_cumulative_pnl_percent',
    'Cumulative P&L percentage'
)

MAX_DRAWDOWN = Gauge(
    'ml_max_drawdown_percent',
    'Maximum drawdown percentage'
)

PAPER_TRADING_DAYS = Gauge(
    'ml_paper_trading_days',
    'Days of paper trading completed'
)


# ===========================================
# Helper Functions
# =============================================

def time_inference(func):
    """Decorator to time inference calls."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        try:
            result = func(*args, **kwargs)
            duration = time.time() - start
            INFERENCE_LATENCY.observe(duration)
            return result
        except Exception as e:
            raise
    return wrapper


def record_signal(symbol: str, action: str, regime: str, confidence: float, strength: float):
    """Record a generated signal."""
    SIGNALS_TOTAL.labels(symbol=symbol, action=action, regime=regime).inc()
    SIGNAL_CONFIDENCE.labels(symbol=symbol).set(confidence)
    SIGNAL_STRENGTH.labels(symbol=symbol).set(strength)


def record_agent_signals(symbol: str, agent_results: dict):
    """Record agent signal values."""
    for agent, result in agent_results.items():
        AGENT_SIGNAL.labels(agent=agent, symbol=symbol).set(result.get('signal', 0))
        AGENT_CONFIDENCE.labels(agent=agent, symbol=symbol).set(result.get('confidence', 0))


def record_regime(regime: str, confidence: float, duration: float):
    """Record current regime state."""
    # Reset all regime gauges
    for r in ['expansion', 'contraction', 'trending', 'choppy', 'unknown']:
        CURRENT_REGIME.labels(regime_name=r).set(1 if r == regime else 0)
    
    REGIME_CONFIDENCE.set(confidence)
    REGIME_DURATION.set(duration)


def record_gate_result(symbol: str, passed: bool, reason: str = ""):
    """Record confidence gate result."""
    if passed:
        GATE_PASSED.labels(symbol=symbol).inc()
    else:
        GATE_BLOCKED.labels(symbol=symbol, reason=reason).inc()


def record_pipeline_stage(stage: str, duration: float):
    """Record pipeline stage latency."""
    PIPELINE_STAGE_LATENCY.labels(stage=stage).observe(duration)


def set_model_version(version: str, trained_on: str, f1: str):
    """Set current model version info."""
    MODEL_VERSION.info({
        'version': version,
        'trained_on': trained_on,
        'f1_score': f1
    })


def get_metrics():
    """Get current metrics for Prometheus scraping."""
    return generate_latest(REGISTRY)


def get_content_type():
    """Get Prometheus content type."""
    return CONTENT_TYPE_LATEST

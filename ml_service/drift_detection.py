"""
Data Drift Detection
Monitors feature distribution changes over time.

Detects:
- Feature drift
- Volume regime shift
- Volatility regime shift
- Concept drift
"""
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from collections import deque
import structlog

logger = structlog.get_logger()


@dataclass
class DriftAlert:
    """Alert for detected drift."""
    feature: str
    drift_score: float
    threshold: float
    timestamp: datetime
    severity: str  # 'low', 'medium', 'high'


class FeatureDistribution:
    """Tracks feature distribution over a rolling window."""
    
    def __init__(self, window_size: int = 1000):
        self.values: deque = deque(maxlen=window_size)
        self.reference_mean: Optional[float] = None
        self.reference_std: Optional[float] = None
    
    def add(self, value: float) -> None:
        """Add a value."""
        self.values.append(value)
    
    def set_reference(self) -> None:
        """Set current distribution as reference."""
        if len(self.values) >= 100:
            self.reference_mean = np.mean(self.values)
            self.reference_std = np.std(self.values) + 1e-6
    
    def get_drift_score(self) -> float:
        """
        Calculate drift score (Population Stability Index inspired).
        Returns: 0-1 normalized drift score
        """
        if self.reference_mean is None or len(self.values) < 50:
            return 0.0
        
        current_mean = np.mean(list(self.values)[-100:])
        current_std = np.std(list(self.values)[-100:]) + 1e-6
        
        # Normalized z-score of mean shift
        mean_shift = abs(current_mean - self.reference_mean) / self.reference_std
        
        # Ratio of standard deviations
        std_ratio = max(current_std / self.reference_std, self.reference_std / current_std)
        
        # Combined score
        drift_score = min(1.0, (mean_shift / 3 + (std_ratio - 1) / 2) / 2)
        
        return drift_score


class DriftDetector:
    """
    Detects distribution drift in features.
    """
    
    def __init__(
        self,
        features: List[str],
        drift_threshold: float = 0.3,
        window_size: int = 1000
    ):
        self.features = features
        self.drift_threshold = drift_threshold
        
        self.distributions: Dict[str, FeatureDistribution] = {
            f: FeatureDistribution(window_size) for f in features
        }
        
        self.alerts: List[DriftAlert] = []
        self.reference_set = False
        
        # Stats
        self.checks_performed = 0
        self.drifts_detected = 0
    
    def update(self, feature_values: Dict[str, float]) -> List[DriftAlert]:
        """
        Update with new feature values.
        Returns any drift alerts.
        """
        new_alerts = []
        
        for feature, value in feature_values.items():
            if feature in self.distributions:
                self.distributions[feature].add(value)
        
        # Check for drift periodically
        self.checks_performed += 1
        if self.checks_performed % 100 == 0 and self.reference_set:
            new_alerts = self.check_drift()
        
        return new_alerts
    
    def set_reference(self) -> None:
        """Set current distributions as reference."""
        for dist in self.distributions.values():
            dist.set_reference()
        self.reference_set = True
        logger.info("drift_reference_set")
    
    def check_drift(self) -> List[DriftAlert]:
        """Check all features for drift."""
        alerts = []
        
        for feature, dist in self.distributions.items():
            score = dist.get_drift_score()
            
            if score >= self.drift_threshold:
                severity = 'high' if score > 0.6 else 'medium' if score > 0.4 else 'low'
                
                alert = DriftAlert(
                    feature=feature,
                    drift_score=score,
                    threshold=self.drift_threshold,
                    timestamp=datetime.now(),
                    severity=severity
                )
                alerts.append(alert)
                self.alerts.append(alert)
                self.drifts_detected += 1
                
                logger.warning("drift_detected",
                             feature=feature,
                             score=round(score, 3),
                             severity=severity)
        
        return alerts
    
    def get_current_scores(self) -> Dict[str, float]:
        """Get current drift scores for all features."""
        return {
            feature: round(dist.get_drift_score(), 3)
            for feature, dist in self.distributions.items()
        }
    
    def get_stats(self) -> dict:
        """Get drift detection statistics."""
        return {
            'checks_performed': self.checks_performed,
            'drifts_detected': self.drifts_detected,
            'reference_set': self.reference_set,
            'features_monitored': len(self.features),
            'current_scores': self.get_current_scores(),
            'recent_alerts': [
                {
                    'feature': a.feature,
                    'score': a.drift_score,
                    'severity': a.severity,
                    'timestamp': a.timestamp.isoformat()
                }
                for a in self.alerts[-10:]
            ]
        }


class ConceptDriftDetector:
    """
    Detects concept drift (model performance degradation).
    """
    
    def __init__(
        self,
        accuracy_window: int = 100,
        accuracy_threshold: float = 0.45
    ):
        self.accuracy_window = accuracy_window
        self.accuracy_threshold = accuracy_threshold
        
        self.predictions: deque = deque(maxlen=accuracy_window)
        self.baseline_accuracy: Optional[float] = None
        
        self.drift_detected = False
        self.drift_timestamp: Optional[datetime] = None
    
    def record_outcome(self, prediction: str, actual: str) -> bool:
        """
        Record prediction outcome.
        Returns True if concept drift detected.
        """
        correct = prediction == actual
        self.predictions.append(correct)
        
        if len(self.predictions) >= self.accuracy_window:
            current_accuracy = sum(self.predictions) / len(self.predictions)
            
            if self.baseline_accuracy is None:
                self.baseline_accuracy = current_accuracy
            
            # Check for significant drop
            if current_accuracy < self.accuracy_threshold:
                if not self.drift_detected:
                    self.drift_detected = True
                    self.drift_timestamp = datetime.now()
                    logger.warning("concept_drift_detected",
                                 accuracy=round(current_accuracy, 3),
                                 baseline=round(self.baseline_accuracy, 3))
                return True
            else:
                self.drift_detected = False
        
        return False
    
    def get_current_accuracy(self) -> float:
        """Get rolling accuracy."""
        if len(self.predictions) == 0:
            return 0.5
        return sum(self.predictions) / len(self.predictions)
    
    def requires_retraining(self) -> bool:
        """Check if retraining is recommended."""
        if not self.drift_detected:
            return False
        
        # Sustained drift for at least 1 hour
        if self.drift_timestamp:
            duration = (datetime.now() - self.drift_timestamp).total_seconds()
            return duration > 3600
        
        return False


# Default features to monitor
DEFAULT_FEATURES = [
    'volume_ratio',
    'volatility',
    'momentum',
    'order_flow_imbalance',
    'spread',
    'vwap_deviation',
    'rsi',
    'macd_signal',
    'atr_pct'
]

# Global detector instances
drift_detector = DriftDetector(DEFAULT_FEATURES)
concept_drift_detector = ConceptDriftDetector()

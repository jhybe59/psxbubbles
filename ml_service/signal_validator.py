"""
Signal Validator
Validates signal quality and correctness.

Checks:
- Signal distribution
- False positive rate
- Noise detection
- Regime filter effectiveness
- Confidence calibration
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from collections import deque
import structlog

logger = structlog.get_logger()


@dataclass
class SignalRecord:
    """Record of a signal for validation."""
    symbol: str
    timestamp: datetime
    action: str
    signal_strength: float
    confidence: float
    regime: str
    
    # Outcome (filled later)
    outcome: Optional[str] = None  # 'correct', 'incorrect', 'neutral'
    actual_return: Optional[float] = None
    

class SignalValidator:
    """
    Validates signal quality against actual outcomes.
    """
    
    def __init__(
        self,
        lookforward_bars: int = 10,
        profit_threshold: float = 0.01,  # 1% move
        history_size: int = 1000
    ):
        self.lookforward_bars = lookforward_bars
        self.profit_threshold = profit_threshold
        
        self.pending_signals: Dict[str, List[SignalRecord]] = {}
        self.validated_signals: deque = deque(maxlen=history_size)
        
        # Stats
        self.total_signals = 0
        self.correct_signals = 0
        self.incorrect_signals = 0
        self.neutral_signals = 0
    
    def record_signal(
        self,
        symbol: str,
        action: str,
        signal_strength: float,
        confidence: float,
        regime: str
    ) -> None:
        """Record a new signal for later validation."""
        record = SignalRecord(
            symbol=symbol,
            timestamp=datetime.now(),
            action=action,
            signal_strength=signal_strength,
            confidence=confidence,
            regime=regime
        )
        
        if symbol not in self.pending_signals:
            self.pending_signals[symbol] = []
        
        self.pending_signals[symbol].append(record)
        self.total_signals += 1
    
    def update_with_price(self, symbol: str, current_price: float, bar_timestamp: datetime) -> List[SignalRecord]:
        """
        Update pending signals with new price data.
        Returns list of newly validated signals.
        """
        if symbol not in self.pending_signals:
            return []
        
        validated = []
        remaining = []
        
        for record in self.pending_signals[symbol]:
            # Check if enough time has passed
            bars_elapsed = (bar_timestamp - record.timestamp).total_seconds() / 60  # Assuming 1-min bars
            
            if bars_elapsed >= self.lookforward_bars:
                # Time to validate
                # We need the entry price - for now use signal timestamp
                # In production, would track actual entry price
                validated.append(record)
            else:
                remaining.append(record)
        
        self.pending_signals[symbol] = remaining
        
        for record in validated:
            self.validated_signals.append(record)
        
        return validated
    
    def validate_signal(
        self,
        record: SignalRecord,
        entry_price: float,
        exit_price: float
    ) -> SignalRecord:
        """
        Validate a signal against actual outcome.
        """
        actual_return = (exit_price - entry_price) / entry_price
        
        # Determine correctness
        if record.action == 'long' or record.action == 'buy':
            if actual_return >= self.profit_threshold:
                outcome = 'correct'
                self.correct_signals += 1
            elif actual_return <= -self.profit_threshold:
                outcome = 'incorrect'
                self.incorrect_signals += 1
            else:
                outcome = 'neutral'
                self.neutral_signals += 1
                
        elif record.action == 'short' or record.action == 'sell':
            if actual_return <= -self.profit_threshold:
                outcome = 'correct'
                self.correct_signals += 1
            elif actual_return >= self.profit_threshold:
                outcome = 'incorrect'
                self.incorrect_signals += 1
            else:
                outcome = 'neutral'
                self.neutral_signals += 1
        else:
            outcome = 'neutral'
            self.neutral_signals += 1
        
        record.outcome = outcome
        record.actual_return = actual_return
        
        return record
    
    def get_accuracy(self) -> float:
        """Get signal accuracy (excluding neutral)."""
        total_decisive = self.correct_signals + self.incorrect_signals
        if total_decisive == 0:
            return 0.5
        return self.correct_signals / total_decisive
    
    def get_stats(self) -> dict:
        """Get validation statistics."""
        total_decisive = self.correct_signals + self.incorrect_signals
        
        return {
            'total_signals': self.total_signals,
            'validated_signals': len(self.validated_signals),
            'pending_signals': sum(len(v) for v in self.pending_signals.values()),
            'correct': self.correct_signals,
            'incorrect': self.incorrect_signals,
            'neutral': self.neutral_signals,
            'accuracy': round(self.get_accuracy(), 3),
            'decisive_rate': round(total_decisive / max(1, len(self.validated_signals)), 3)
        }
    
    def get_stats_by_regime(self) -> Dict[str, dict]:
        """Get accuracy broken down by regime."""
        regime_stats: Dict[str, Dict[str, int]] = {}
        
        for record in self.validated_signals:
            if record.regime not in regime_stats:
                regime_stats[record.regime] = {'correct': 0, 'incorrect': 0, 'neutral': 0}
            
            if record.outcome:
                regime_stats[record.regime][record.outcome] += 1
        
        result = {}
        for regime, stats in regime_stats.items():
            total = stats['correct'] + stats['incorrect']
            result[regime] = {
                'correct': stats['correct'],
                'incorrect': stats['incorrect'],
                'neutral': stats['neutral'],
                'accuracy': round(stats['correct'] / max(1, total), 3)
            }
        
        return result
    
    def get_stats_by_confidence(self, bins: int = 5) -> List[dict]:
        """Get accuracy broken down by confidence level."""
        bin_edges = np.linspace(0, 1, bins + 1)
        bin_stats = [{
            'range': f"{bin_edges[i]:.1f}-{bin_edges[i+1]:.1f}",
            'correct': 0,
            'incorrect': 0,
            'neutral': 0
        } for i in range(bins)]
        
        for record in self.validated_signals:
            bin_idx = min(int(record.confidence * bins), bins - 1)
            if record.outcome:
                bin_stats[bin_idx][record.outcome] += 1
        
        for stat in bin_stats:
            total = stat['correct'] + stat['incorrect']
            stat['accuracy'] = round(stat['correct'] / max(1, total), 3)
        
        return bin_stats
    
    def check_calibration(self) -> dict:
        """
        Check if confidence is calibrated.
        Well-calibrated: 70% confidence should be correct ~70% of the time.
        """
        by_confidence = self.get_stats_by_confidence(10)
        
        calibration_errors = []
        for i, stat in enumerate(by_confidence):
            expected_accuracy = (i + 0.5) / 10  # Midpoint of bin
            actual_accuracy = stat['accuracy']
            
            total = stat['correct'] + stat['incorrect']
            if total >= 10:  # Only consider bins with enough samples
                calibration_errors.append(abs(actual_accuracy - expected_accuracy))
        
        avg_calibration_error = np.mean(calibration_errors) if calibration_errors else 0
        
        return {
            'calibration_error': round(avg_calibration_error, 3),
            'is_calibrated': avg_calibration_error < 0.15,
            'by_confidence': by_confidence
        }


class NoiseDetector:
    """
    Detects noisy/low-quality signal patterns.
    """
    
    def __init__(self, window_size: int = 100):
        self.window_size = window_size
        self.recent_signals: deque = deque(maxlen=window_size)
    
    def record_signal(self, symbol: str, action: str, signal_strength: float):
        """Record signal for noise analysis."""
        self.recent_signals.append({
            'symbol': symbol,
            'action': action,
            'signal_strength': signal_strength,
            'timestamp': datetime.now()
        })
    
    def check_noise(self) -> dict:
        """Analyze for noisy patterns."""
        if len(self.recent_signals) < 10:
            return {'status': 'insufficient_data'}
        
        # Check for flip-flopping (rapid direction changes)
        directions = [1 if s['action'] in ['long', 'buy'] else -1 
                     for s in self.recent_signals 
                     if s['action'] not in ['hold']]
        
        if len(directions) < 5:
            return {'status': 'insufficient_trades'}
        
        flips = sum(1 for i in range(1, len(directions)) 
                   if directions[i] != directions[i-1])
        flip_rate = flips / len(directions)
        
        # Check for weak signals
        strengths = [abs(s['signal_strength']) for s in self.recent_signals]
        avg_strength = np.mean(strengths)
        weak_pct = sum(1 for s in strengths if s < 0.3) / len(strengths)
        
        # Check signal clustering (too many signals in short time)
        if len(self.recent_signals) >= 2:
            times = [s['timestamp'] for s in self.recent_signals]
            intervals = [(times[i] - times[i-1]).total_seconds() 
                        for i in range(1, len(times))]
            avg_interval = np.mean(intervals) if intervals else 0
            rapid_signals = sum(1 for i in intervals if i < 30) / max(1, len(intervals))
        else:
            avg_interval = 0
            rapid_signals = 0
        
        is_noisy = flip_rate > 0.5 or weak_pct > 0.5 or rapid_signals > 0.3
        
        return {
            'is_noisy': is_noisy,
            'flip_rate': round(flip_rate, 3),
            'avg_signal_strength': round(avg_strength, 3),
            'weak_signal_pct': round(weak_pct, 3),
            'avg_interval_seconds': round(avg_interval, 1),
            'rapid_signal_pct': round(rapid_signals, 3)
        }


# Global instances
signal_validator = SignalValidator()
noise_detector = NoiseDetector()

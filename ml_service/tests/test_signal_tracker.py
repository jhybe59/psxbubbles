"""
Tests for Phase 7 Signal Tracker
"""
import pytest
import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

# Import the module under test
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from signal_tracker import SignalTracker, TrackedSignal, SignalType


class TestTrackedSignal:
    """Tests for TrackedSignal dataclass."""
    
    def test_create_signal(self):
        """Test creating a TrackedSignal."""
        signal = TrackedSignal(
            signal_id="test-123",
            symbol="LUCK",
            timestamp=datetime.now(),
            signal_type="pump",
            confidence=0.75,
            regime="breakout",
            direction=1,
            signal_strength=0.8,
            entry_price=100.0
        )
        
        assert signal.signal_id == "test-123"
        assert signal.symbol == "LUCK"
        assert signal.signal_type == "pump"
        assert signal.confidence == 0.75
        assert signal.direction == 1
        assert signal.entry_price == 100.0
        assert signal.outcome_complete is False
    
    def test_to_dict(self):
        """Test serializing TrackedSignal."""
        signal = TrackedSignal(
            signal_id="test-456",
            symbol="ENGRO",
            timestamp=datetime.now(),
            signal_type="buy",
            confidence=0.65,
            regime="trending",
            direction=1,
            signal_strength=0.6,
            entry_price=200.0
        )
        
        d = signal.to_dict()
        
        assert d['signal_id'] == "test-456"
        assert d['symbol'] == "ENGRO"
        assert 'timestamp' in d
        assert isinstance(d['timestamp'], str)  # ISO format
    
    def test_from_dict(self):
        """Test deserializing TrackedSignal."""
        d = {
            'signal_id': 'test-789',
            'symbol': 'OGDC',
            'timestamp': '2026-02-09T10:00:00',
            'created_at': '2026-02-09T10:00:00',
            'signal_type': 'sell',
            'confidence': 0.7,
            'regime': 'chop',
            'direction': -1,
            'signal_strength': -0.5,
            'entry_price': 150.0,
            'atr': 2.5,
            'agent_signals': {},
            'agreement_score': 0.8,
            'price_1m': None,
            'price_3m': None,
            'price_5m': None,
            'price_15m': None,
            'min_price_5m': None,
            'max_price_5m': None,
            'accuracy': None,
            'profit_pct': None,
            'max_adverse': None,
            'max_favorable': None,
            'outcome_complete': False
        }
        
        signal = TrackedSignal.from_dict(d)
        
        assert signal.signal_id == 'test-789'
        assert signal.symbol == 'OGDC'
        assert signal.direction == -1


class TestSignalTracker:
    """Tests for SignalTracker class."""
    
    @pytest.fixture
    def tracker(self):
        """Create a fresh tracker for each test."""
        return SignalTracker(redis_url="redis://localhost:6379")
    
    @pytest.mark.asyncio
    async def test_record_signal(self, tracker):
        """Test recording a signal."""
        with patch.object(tracker, '_publish_signal', new_callable=AsyncMock):
            signal_id = await tracker.record_signal(
                symbol="LUCK",
                signal_type="pump",
                confidence=0.75,
                regime="breakout",
                direction=1,
                signal_strength=0.8,
                entry_price=100.0,
                atr=2.0
            )
        
        assert signal_id is not None
        assert len(signal_id) == 36  # UUID format
        assert signal_id in tracker.signals
        assert tracker.metrics['signals_recorded'] == 1
    
    @pytest.mark.asyncio
    async def test_update_outcome(self, tracker):
        """Test updating signal outcomes."""
        with patch.object(tracker, '_publish_signal', new_callable=AsyncMock):
            signal_id = await tracker.record_signal(
                symbol="LUCK",
                signal_type="pump",
                confidence=0.75,
                regime="breakout",
                direction=1,
                signal_strength=0.8,
                entry_price=100.0
            )
        
        # Update 1m outcome
        result = await tracker.update_outcome(signal_id, '1m', 101.0)
        assert result is True
        
        signal = tracker.get_signal(signal_id)
        assert signal.price_1m == 101.0
    
    def test_calculate_metrics_long_profit(self, tracker):
        """Test P&L calculation for profitable long."""
        signal = TrackedSignal(
            signal_id="test-pnl",
            symbol="LUCK",
            timestamp=datetime.now(),
            signal_type="pump",
            confidence=0.75,
            regime="breakout",
            direction=1,
            signal_strength=0.8,
            entry_price=100.0
        )
        signal.price_5m = 102.0  # 2% profit
        
        tracker._calculate_signal_metrics(signal)
        
        # Expected: 2% - 0.15% (slippage + commission) = ~1.85%
        assert signal.profit_pct is not None
        assert signal.profit_pct > 0.015  # At least 1.5% after costs
        assert signal.accuracy is True
    
    def test_calculate_metrics_long_loss(self, tracker):
        """Test P&L calculation for losing long."""
        signal = TrackedSignal(
            signal_id="test-loss",
            symbol="LUCK",
            timestamp=datetime.now(),
            signal_type="pump",
            confidence=0.75,
            regime="breakout",
            direction=1,
            signal_strength=0.8,
            entry_price=100.0
        )
        signal.price_5m = 98.0  # 2% loss
        
        tracker._calculate_signal_metrics(signal)
        
        assert signal.profit_pct is not None
        assert signal.profit_pct < 0  # Should be negative
        assert signal.accuracy is False
    
    def test_get_edge_insufficient_data(self, tracker):
        """Test edge returns 0 with insufficient data."""
        edge = tracker.get_edge("pump")
        assert edge == 0.0
    
    def test_get_recent_signals(self, tracker):
        """Test getting recent signals."""
        # Add some signals directly
        for i in range(5):
            tracker.signals[f"sig-{i}"] = TrackedSignal(
                signal_id=f"sig-{i}",
                symbol="LUCK" if i % 2 == 0 else "ENGRO",
                timestamp=datetime.now(),
                signal_type="pump",
                confidence=0.7,
                regime="breakout",
                direction=1,
                signal_strength=0.5,
                entry_price=100.0
            )
        
        # Get all
        all_signals = tracker.get_recent_signals()
        assert len(all_signals) == 5
        
        # Filter by symbol
        luck_signals = tracker.get_recent_signals(symbol="LUCK")
        assert len(luck_signals) == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

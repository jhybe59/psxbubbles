"""
End-to-End Test Suite
Validates the complete inference pipeline.

Tests:
1. Data flow integrity
2. Latency profiling
3. Signal validity
4. Risk system
5. Stability
"""
import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import pandas as pd
import numpy as np
import structlog

# Components
from bar_engine import BarEngineManager, TimeBarEngine
from advanced_features import AdvancedFeatureEngine
from intelligence import IntelligenceSystem
from confidence_gate import ConfidenceGate, GateConfig
from throttler import SignalThrottler
from risk_filter import RiskFilter
from latency_profiler import latency_profiler

logger = structlog.get_logger()


class E2ETestResult:
    """Test result container."""
    
    def __init__(self, name: str):
        self.name = name
        self.passed = False
        self.details = {}
        self.errors = []
        self.warnings = []
        self.start_time = datetime.now()
        self.end_time = None
    
    def pass_test(self, details: dict = None):
        self.passed = True
        self.details = details or {}
        self.end_time = datetime.now()
    
    def fail_test(self, error: str, details: dict = None):
        self.passed = False
        self.errors.append(error)
        self.details = details or {}
        self.end_time = datetime.now()
    
    def add_warning(self, warning: str):
        self.warnings.append(warning)
    
    def to_dict(self) -> dict:
        return {
            'name': self.name,
            'passed': self.passed,
            'errors': self.errors,
            'warnings': self.warnings,
            'details': self.details,
            'duration_ms': (self.end_time - self.start_time).total_seconds() * 1000 if self.end_time else None
        }


class E2ETestSuite:
    """
    Comprehensive end-to-end test suite.
    """
    
    def __init__(self):
        self.results: List[E2ETestResult] = []
        
        # Initialize components
        self.bar_engine = BarEngineManager("TEST")
        self.bar_engine.add_engine("time_60s", TimeBarEngine(interval_seconds=60))
        
        self.feature_engine = AdvancedFeatureEngine()
        self.intelligence = IntelligenceSystem()
        self.confidence_gate = ConfidenceGate()
        self.throttler = SignalThrottler()
        self.risk_filter = RiskFilter()
    
    def run_all_tests(self) -> dict:
        """Run all tests and return results."""
        logger.info("e2e_test_suite_starting")
        
        # Run tests
        self.test_data_flow()
        self.test_bar_aggregation()
        self.test_feature_computation()
        self.test_agent_analysis()
        self.test_confidence_gate()
        self.test_throttler()
        self.test_risk_filter()
        self.test_latency()
        self.test_pipeline_integrity()
        
        # Summarize
        passed = sum(1 for r in self.results if r.passed)
        failed = sum(1 for r in self.results if not r.passed)
        
        summary = {
            'total_tests': len(self.results),
            'passed': passed,
            'failed': failed,
            'pass_rate': passed / len(self.results) if self.results else 0,
            'results': [r.to_dict() for r in self.results],
            'timestamp': datetime.now().isoformat()
        }
        
        logger.info("e2e_test_suite_complete", passed=passed, failed=failed)
        
        return summary
    
    def test_data_flow(self):
        """Test 1: Basic data flow through pipeline."""
        result = E2ETestResult("data_flow")
        
        try:
            # Generate synthetic tick data
            ticks = self._generate_ticks(100)
            
            # Process through bar engine
            bars = []
            for tick in ticks:
                bar_result = self.bar_engine.add_tick(tick)
                for bar_type, bar in bar_result.items():
                    if bar:
                        bars.append(bar)
            
            if not bars:
                result.fail_test("No bars generated from ticks")
                self.results.append(result)
                return
            
            # Convert to DataFrame
            df = pd.DataFrame(bars)
            
            if df.empty:
                result.fail_test("Empty DataFrame from bars")
                self.results.append(result)
                return
            
            # Verify required columns
            required = ['open', 'high', 'low', 'close', 'volume']
            missing = [c for c in required if c not in df.columns]
            
            if missing:
                result.fail_test(f"Missing columns: {missing}")
                self.results.append(result)
                return
            
            result.pass_test({
                'ticks_processed': len(ticks),
                'bars_created': len(bars),
                'columns': list(df.columns)
            })
            
        except Exception as e:
            result.fail_test(str(e))
        
        self.results.append(result)
    
    def test_bar_aggregation(self):
        """Test 2: Bar aggregation correctness."""
        result = E2ETestResult("bar_aggregation")
        
        try:
            # Generate ticks with known properties
            base_price = 100.0
            ticks = []
            total_volume = 0
            
            for i in range(120):  # 2 minutes of ticks
                price = base_price + np.random.randn() * 0.5
                volume = int(100 + np.random.rand() * 50)
                total_volume += volume
                
                ticks.append({
                    'timestamp': datetime.now() + timedelta(seconds=i),
                    'price': price,
                    'volume': volume
                })
            
            # Process
            engine = BarEngineManager("TEST2")
            engine.add_engine("time_60s", TimeBarEngine(interval_seconds=60))
            
            bars = []
            for tick in ticks:
                bar_result = engine.add_tick(tick)
                for _, bar in bar_result.items():
                    if bar:
                        bars.append(bar)
            
            if len(bars) < 1:
                result.add_warning("Fewer bars than expected")
            
            # Verify OHLC integrity
            for bar in bars:
                if bar['high'] < bar['low']:
                    result.fail_test("High < Low violation")
                    self.results.append(result)
                    return
                
                if bar['close'] > bar['high'] or bar['close'] < bar['low']:
                    result.fail_test("Close outside High/Low range")
                    self.results.append(result)
                    return
            
            result.pass_test({
                'bars_created': len(bars),
                'ticks_processed': len(ticks)
            })
            
        except Exception as e:
            result.fail_test(str(e))
        
        self.results.append(result)
    
    def test_feature_computation(self):
        """Test 3: Feature computation."""
        result = E2ETestResult("feature_computation")
        
        try:
            # Create sample bar data
            df = self._generate_bar_df(100)
            
            # Compute features
            latency_profiler.start("feature_compute", "TEST")
            features_df = self.feature_engine.compute_all_features(df, "TEST")
            latency_ms = latency_profiler.end("feature_compute")
            
            if features_df.empty:
                result.fail_test("Empty features DataFrame")
                self.results.append(result)
                return
            
            # Check for NaN explosion
            nan_ratio = features_df.isna().sum().sum() / features_df.size
            if nan_ratio > 0.5:
                result.fail_test(f"Too many NaN values: {nan_ratio:.1%}")
                self.results.append(result)
                return
            
            # Check for inf values
            inf_count = np.isinf(features_df.select_dtypes(include=[np.number])).sum().sum()
            if inf_count > 0:
                result.add_warning(f"Found {inf_count} inf values")
            
            result.pass_test({
                'input_rows': len(df),
                'output_rows': len(features_df),
                'features_computed': len(features_df.columns),
                'latency_ms': round(latency_ms, 2),
                'nan_ratio': round(nan_ratio, 3)
            })
            
        except Exception as e:
            result.fail_test(str(e))
        
        self.results.append(result)
    
    def test_agent_analysis(self):
        """Test 4: Agent analysis."""
        result = E2ETestResult("agent_analysis")
        
        try:
            df = self._generate_bar_df(100)
            features_df = self.feature_engine.compute_all_features(df, "TEST")
            
            # Train intelligence system
            self.intelligence.train(features_df)
            
            # Run analysis
            latency_profiler.start("intelligence_analyze", "TEST")
            analysis = self.intelligence.analyze("TEST", features_df)
            latency_ms = latency_profiler.end("intelligence_analyze")
            
            if 'error' in analysis:
                result.fail_test(analysis['error'])
                self.results.append(result)
                return
            
            signal = analysis.get('signal', {})
            
            # Validate signal structure
            required_keys = ['signal_strength', 'direction', 'confidence', 'action']
            missing = [k for k in required_keys if k not in signal]
            
            if missing:
                result.fail_test(f"Missing signal keys: {missing}")
                self.results.append(result)
                return
            
            # Validate ranges
            if not -1 <= signal.get('signal_strength', 0) <= 1:
                result.add_warning("Signal strength out of [-1, 1] range")
            
            if not 0 <= signal.get('confidence', 0) <= 1:
                result.add_warning("Confidence out of [0, 1] range")
            
            result.pass_test({
                'signal': signal,
                'latency_ms': round(latency_ms, 2)
            })
            
        except Exception as e:
            result.fail_test(str(e))
        
        self.results.append(result)
    
    def test_confidence_gate(self):
        """Test 5: Confidence gate filtering."""
        result = E2ETestResult("confidence_gate")
        
        try:
            from fusion.ensemble import FusedSignal
            
            gate = ConfidenceGate(GateConfig(min_confidence=0.6))
            
            # Test low confidence - should block
            low_signal = FusedSignal(
                signal_strength=0.5,
                direction=1,
                confidence=0.4,
                regime="normal",
                agent_signals={},
                agreement_score=0.5,
                weighted_contributions={},
                action="buy"
            )
            
            passed, reason = gate.gate(low_signal)
            if passed:
                result.fail_test("Low confidence signal should be blocked")
                self.results.append(result)
                return
            
            # Test high confidence - should pass
            high_signal = FusedSignal(
                signal_strength=0.7,
                direction=1,
                confidence=0.75,
                regime="expansion",
                agent_signals={},
                agreement_score=0.7,
                weighted_contributions={},
                action="buy"
            )
            
            passed, reason = gate.gate(high_signal)
            if not passed:
                result.fail_test(f"High confidence signal should pass: {reason}")
                self.results.append(result)
                return
            
            stats = gate.get_stats()
            result.pass_test({
                'tested_signals': stats['total_received'],
                'passed': stats['total_passed'],
                'blocked': stats['total_blocked']
            })
            
        except Exception as e:
            result.fail_test(str(e))
        
        self.results.append(result)
    
    def test_throttler(self):
        """Test 6: Signal throttling."""
        result = E2ETestResult("throttler")
        
        try:
            from throttler import ThrottleConfig
            
            throttler = SignalThrottler(ThrottleConfig(
                min_interval_seconds=5,
                max_signals_per_symbol=10
            ))
            
            # First signal should pass
            can_emit, _ = throttler.can_emit("TEST")
            if not can_emit:
                result.fail_test("First signal should be allowed")
                self.results.append(result)
                return
            
            throttler.record_signal("TEST")
            
            # Immediate second signal should be blocked
            can_emit, reason = throttler.can_emit("TEST")
            if can_emit:
                result.fail_test("Immediate second signal should be throttled")
                self.results.append(result)
                return
            
            result.pass_test({
                'throttle_working': True,
                'interval_seconds': 5
            })
            
        except Exception as e:
            result.fail_test(str(e))
        
        self.results.append(result)
    
    def test_risk_filter(self):
        """Test 7: Risk filter constraints."""
        result = E2ETestResult("risk_filter")
        
        try:
            from risk_filter import RiskLimits, PositionState, RiskFilter
            from fusion.decision_engine import TradeDecision
            
            limits = RiskLimits(
                max_position_per_symbol_pct=10.0,
                max_total_exposure_pct=30.0
            )
            
            state = PositionState()
            state.positions = {"EXISTING": 25.0}  # Already 25% exposed
            
            risk_filter = RiskFilter(limits, state)
            
            # New large position should be blocked
            decision = TradeDecision(
                symbol="NEW",
                timestamp=datetime.now(),
                action="long",
                signal_strength=0.8,
                confidence=0.8,
                position_size_pct=15.0,  # Would exceed 30% total
                risk_pct=1.0
            )
            
            passed, reason = risk_filter.check(decision)
            if passed:
                result.fail_test("Should block due to exposure limit")
                self.results.append(result)
                return
            
            # Small position should pass
            small_decision = TradeDecision(
                symbol="SMALL",
                timestamp=datetime.now(),
                action="long",
                signal_strength=0.8,
                confidence=0.8,
                position_size_pct=4.0,  # Within limits
                risk_pct=0.5
            )
            
            passed, reason = risk_filter.check(small_decision)
            if not passed:
                result.fail_test(f"Small position should pass: {reason}")
                self.results.append(result)
                return
            
            result.pass_test({
                'risk_filter_working': True,
                'current_exposure': 25.0
            })
            
        except Exception as e:
            result.fail_test(str(e))
        
        self.results.append(result)
    
    def test_latency(self):
        """Test 8: Latency targets."""
        result = E2ETestResult("latency")
        
        try:
            # Run multiple iterations
            for _ in range(10):
                df = self._generate_bar_df(50)
                
                latency_profiler.start("total_e2e", "TEST")
                
                latency_profiler.start("feature_compute", "TEST")
                features = self.feature_engine.compute_all_features(df, "TEST")
                latency_profiler.end("feature_compute")
                
                latency_profiler.start("intelligence_analyze", "TEST")
                self.intelligence.analyze("TEST", features)
                latency_profiler.end("intelligence_analyze")
                
                latency_profiler.end("total_e2e")
            
            summary = latency_profiler.get_summary()
            
            violations = summary.get('violations', [])
            if violations:
                result.add_warning(f"Latency violations: {violations}")
            
            result.pass_test({
                'stages': summary['stages'],
                'violations': len(violations)
            })
            
        except Exception as e:
            result.fail_test(str(e))
        
        self.results.append(result)
    
    def test_pipeline_integrity(self):
        """Test 9: Full pipeline integrity."""
        result = E2ETestResult("pipeline_integrity")
        
        try:
            # Simulate full flow
            ticks = self._generate_ticks(200)
            bars_buffer = []
            signals_generated = 0
            
            for tick in ticks:
                # Bar aggregation
                bar_result = self.bar_engine.add_tick(tick)
                
                for _, bar in bar_result.items():
                    if bar:
                        bars_buffer.append(bar)
                        
                        # Check if we have enough for inference
                        if len(bars_buffer) >= 50:
                            df = pd.DataFrame(bars_buffer[-100:])
                            
                            # Feature + Inference
                            features = self.feature_engine.compute_all_features(df, "TEST")
                            analysis = self.intelligence.analyze("TEST", features)
                            
                            if 'signal' in analysis:
                                signals_generated += 1
            
            if signals_generated == 0:
                result.fail_test("No signals generated in full pipeline test")
                self.results.append(result)
                return
            
            result.pass_test({
                'ticks_processed': len(ticks),
                'bars_created': len(bars_buffer),
                'signals_generated': signals_generated
            })
            
        except Exception as e:
            result.fail_test(str(e))
        
        self.results.append(result)
    
    def _generate_ticks(self, count: int) -> List[dict]:
        """Generate synthetic tick data."""
        base_price = 100.0
        ticks = []
        
        for i in range(count):
            price = base_price + np.cumsum(np.random.randn(1) * 0.1)[0]
            base_price = price
            
            ticks.append({
                'timestamp': datetime.now() + timedelta(seconds=i),
                'price': round(price, 2),
                'volume': int(100 + np.random.rand() * 200)
            })
        
        return ticks
    
    def _generate_bar_df(self, rows: int) -> pd.DataFrame:
        """Generate synthetic bar DataFrame."""
        base_price = 100.0
        data = []
        
        for i in range(rows):
            change = np.random.randn() * 0.5
            open_p = base_price
            close_p = base_price + change
            high_p = max(open_p, close_p) + abs(np.random.randn() * 0.2)
            low_p = min(open_p, close_p) - abs(np.random.randn() * 0.2)
            
            data.append({
                'timestamp': datetime.now() + timedelta(minutes=i),
                'open': round(open_p, 2),
                'high': round(high_p, 2),
                'low': round(low_p, 2),
                'close': round(close_p, 2),
                'volume': int(1000 + np.random.rand() * 5000)
            })
            
            base_price = close_p
        
        df = pd.DataFrame(data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df.set_index('timestamp', inplace=True)
        return df


def run_tests():
    """Run all tests and print results."""
    suite = E2ETestSuite()
    results = suite.run_all_tests()
    
    print("\n" + "="*60)
    print("E2E TEST RESULTS")
    print("="*60)
    
    for test in results['results']:
        status = "✅ PASS" if test['passed'] else "❌ FAIL"
        print(f"\n{status} {test['name']}")
        
        if test['errors']:
            for err in test['errors']:
                print(f"  Error: {err}")
        
        if test['warnings']:
            for warn in test['warnings']:
                print(f"  Warning: {warn}")
        
        if test['details']:
            for key, val in test['details'].items():
                print(f"  {key}: {val}")
    
    print("\n" + "="*60)
    print(f"SUMMARY: {results['passed']}/{results['total_tests']} passed ({results['pass_rate']:.0%})")
    print("="*60)
    
    return results


if __name__ == "__main__":
    run_tests()

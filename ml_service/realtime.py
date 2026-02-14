"""
Real-time Inference Loop
Main streaming inference engine that processes ticks → signals.

Pipeline:
1. Redis subscription (ticks.raw.*)
2. Bar aggregation
3. Feature computation  
4. Agent analysis
5. Fusion
6. Confidence gating
7. Risk filtering
8. Throttling
9. Decision
10. Signal publishing
"""
import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Set
import redis.asyncio as aioredis
import pandas as pd
import structlog
from export import DataExporter

from config import settings
from bar_engine import BarEngineManager, TimeBarEngine, Tick
from advanced_features import AdvancedFeatureEngine
from intelligence import IntelligenceSystem
from confidence_gate import ConfidenceGate, GateConfig
from throttler import SignalThrottler, ThrottleConfig
from risk_filter import RiskFilter, RiskLimits
from signal_router import SignalRouter
from quest_writer import QuestDBWriter
import metrics

logger = structlog.get_logger()


class RealtimeInference:
    """
    Real-time inference engine.
    
    Subscribes to tick stream, processes through ML pipeline,
    emits filtered signals.
    """
    
    def __init__(
        self,
        symbols: Optional[Set[str]] = None,
        redis_url: str = settings.redis_url,
        bar_interval_seconds: int = 60,
        intelligence: Optional[IntelligenceSystem] = None
    ):
        self.symbols = symbols or set()
        self.redis_url = redis_url
        self.bar_interval = bar_interval_seconds
        
        self.redis = None
        self.pubsub = None
        self.running = False
        
        # Intelligence System
        if intelligence:
            self.intelligence = intelligence
        else:
            self.intelligence = IntelligenceSystem()
            self.intelligence.load()
        
        self.min_bars_for_features = 50 # Minimum history needed
        
        # Bar engines per symbol
        self.bar_engines: Dict[str, BarEngineManager] = {}
        
        # Feature engine
        self.feature_engine = AdvancedFeatureEngine()
        
        # Safety systems
        self.confidence_gate = ConfidenceGate()
        self.throttler = SignalThrottler()
        self.risk_filter = RiskFilter()
        
        # Signal router
        self.router = SignalRouter(redis_url)
        
        # Data Exporter
        self.exporter = DataExporter()

        # Database Writer
        self.db_writer = QuestDBWriter(settings.questdb_dsn)
        
        # State
        self.running = False
        self.bars_buffer: Dict[str, list] = {}  # symbol -> list of bars
        self.min_bars_for_features = 50
        
        # Stats
        self.ticks_processed = 0
        self.signals_generated = 0
        self.last_tick_time: Dict[str, datetime] = {}
    
    async def start(self) -> None:
        """Start the inference loop."""
        logger.info("realtime_inference_starting", symbols=list(self.symbols))
        
        # Connect to Redis
        self.redis = aioredis.from_url(self.redis_url)
        await self.redis.ping()
        
        # Connect router
        await self.router.connect()
        
        # Initialize bar engines
        for symbol in self.symbols:
            self.bar_engines[symbol] = BarEngineManager(symbol)
            self.bar_engines[symbol].add_engine(
                f"time_{self.bar_interval}s",
                TimeBarEngine(symbol=symbol, interval_seconds=self.bar_interval)
            )
            self.bars_buffer[symbol] = []
        
        # Subscribe to tick channels
        self.pubsub = self.redis.pubsub()
        
        if self.symbols:
            channels = [f"ticks.raw.{symbol}" for symbol in self.symbols]
        else:
            channels = ["ticks.raw.*"]
        
        await self.pubsub.psubscribe(*channels)
        
        self.running = True
        logger.info("realtime_inference_started")
        
        # Main loop
        await self._run_loop()
    
    async def stop(self) -> None:
        """Stop the inference loop."""
        self.running = False
        
        if self.pubsub:
            await self.pubsub.unsubscribe()
        
        await self.router.close()
        
        if self.redis:
            await self.redis.close()
        
        logger.info("realtime_inference_stopped",
                    ticks=self.ticks_processed,
                    signals=self.signals_generated)
        
        if self.db_writer:
            self.db_writer.stop()
    
    async def _run_loop(self) -> None:
        """Main processing loop."""
        async for message in self.pubsub.listen():
            if not self.running:
                break
            
            logger.info("redis_message_received", type=message['type'], channel=message.get('channel'))

            if message['type'] in ['pmessage', 'message']:
                try:
                    await self._process_message(message)
                except Exception as e:
                    logger.error("message_processing_error", error=str(e))
    
    async def _process_message(self, message: dict) -> None:
        """Process a single tick message."""
        # Extract symbol from channel
        channel = message['channel'].decode() if isinstance(message['channel'], bytes) else message['channel']
        symbol = channel.split('.')[-1]
        
        # Parse tick data
        try:
            data = json.loads(message['data'])
        except json.JSONDecodeError:
            return
        
        self.ticks_processed += 1
        self.last_tick_time[symbol] = datetime.now()
        
        # Ensure we have engines for this symbol
        if symbol not in self.bar_engines:
            self.add_symbol(symbol)
        
        # Convert to tick object
        ts = data.get('timestamp')
        if isinstance(ts, str):
            try:
                timestamp = datetime.fromisoformat(ts.replace('Z', '+00:00'))
            except:
                timestamp = datetime.now()
        else:
            timestamp = datetime.now()

        tick = Tick(
            timestamp=timestamp,
            symbol=symbol,
            price=float(data.get('price', data.get('ltp', 0))),
            volume=int(data.get('volume', data.get('vol', 0))),
            side=data.get('side')
        )
        
        # Process through bar engine
        try:
            bars = self.bar_engines[symbol].add_tick(tick)
            
            # If new bar completed
            for bar_type, bar_data in bars.items():
                if bar_data:
                    # Convert Bar object to dict
                    bar_dict = bar_data.__dict__ if hasattr(bar_data, '__dict__') else bar_data
                    self.bars_buffer[symbol].append(bar_dict)
                    
                    # Keep buffer manageable
                    if len(self.bars_buffer[symbol]) > 200:
                        self.bars_buffer[symbol] = self.bars_buffer[symbol][-200:]
                    
                    # Check if we have enough bars
                    logger.info("buffer_update", symbol=symbol, current_len=len(self.bars_buffer[symbol]), min_required=self.min_bars_for_features)
                    
                    if len(self.bars_buffer[symbol]) >= self.min_bars_for_features:
                        await self._run_inference(symbol)
            
            # Log every 10th tick to avoid spam, but prove it's working
            if self.ticks_processed % 10 == 0:
                logger.info("processed_tick", symbol=symbol, buffer_len=len(self.bars_buffer[symbol]))

        except Exception as e:
            logger.error("tick_processing_failed", symbol=symbol, error=str(e))
    
    async def _run_inference(self, symbol: str) -> None:
        """Run full inference pipeline for symbol."""
        try:
            # Convert bars to DataFrame
            df = pd.DataFrame(self.bars_buffer[symbol])
            
            # Handle mixed keys (backfill has 'timestamp', live has 'start_time')
            if 'start_time' in df.columns:
                df['start_time'] = pd.to_datetime(df['start_time'], utc=True)
            
            if 'timestamp' not in df.columns:
                 if 'start_time' in df.columns:
                     df['timestamp'] = df['start_time']
            elif 'start_time' in df.columns:
                df['timestamp'] = df['timestamp'].fillna(df['start_time'])
                
            if 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
            
            df.set_index('timestamp', inplace=True)
            df.sort_index(inplace=True)
            
            # Fill missing columns for backfill data
            if 'vwap' in df.columns:
                df['vwap'] = df['vwap'].fillna(df['close'])
            else:
                df['vwap'] = df['close']
                
            if 'ticks' in df.columns:
                df['ticks'] = df['ticks'].fillna(0) # or 1

            # Fill start/end time for backfill
            if 'start_time' in df.columns:
                df['start_time'] = df['start_time'].fillna(df.index.to_series())
            else:
                df['start_time'] = df.index.to_series()
                
            if 'end_time' in df.columns:
                # Assume 1m bars for backfill if missing
                df['end_time'] = df['end_time'].fillna(df.index.to_series() + pd.Timedelta(minutes=1))
            else:
                 df['end_time'] = df.index.to_series() + pd.Timedelta(minutes=1)


            # Ensure numeric types
            numeric_cols = ['open', 'high', 'low', 'close', 'volume', 'vwap']
            for col in numeric_cols:
                if col in df.columns:
                    df[col] = df[col].astype(float)
            
            # Ensured numeric types above
            
            # Fill missing order flow columns (CRITICAL for backfill)
            # These are often missing in historical bars but required by advanced_features
            order_flow_cols = ['buy_volume', 'sell_volume', 'buy_cost', 'sell_cost']
            for col in order_flow_cols:
                if col not in df.columns:
                    df[col] = df['volume'] / 2 # Crude approximation
                else:
                    df[col] = df[col].fillna(0)

            # CRITICAL: Fill any remaining NaNs (e.g. spread from live tick missing in backfill)
            # This prevents dropna() in advanced_features from killing the backfill history
            df = df.fillna(0)

            # Get analysis from intelligence system
            start_time = time.time()
            result = self.intelligence.analyze(
                symbol=symbol,
                df=df,
                current_price=df['close'].iloc[-1]
            )
            duration = time.time() - start_time
            metrics.INFERENCE_LATENCY.observe(duration)
            
            if 'error' in result:
                return
            
            signal = result.get('signal', {})
            decision = result.get('decision', {})

            # Record metrics
            metrics.MODEL_PREDICTIONS.labels(model="default").inc()
            
            # 1. Main Signal
            metrics.record_signal(
                symbol=symbol,
                action=decision.get('action', 'hold'),
                regime=signal.get('regime', 'unknown'),
                confidence=signal.get('confidence', 0),
                strength=signal.get('signal_strength', 0)
            )
            
            # 2. Regime (Fixing "No data")
            metrics.record_regime(
                regime=signal.get('regime', 'unknown'),
                confidence=signal.get('confidence', 0), # Using signal confidence as proxy if regime conf not avail
                duration=0 # TODO: Track duration
            )
            
            # 3. Agent Signals (Fixing "No data")
            if 'agent_signals' in signal:
                # agent_signals is dict {name: {signal_strength, confidence, ...}}
                # metrics.record_agent_signals expects {name: {signal: val, confidence: val}}
                # We need to map it correctly
                agent_metrics = {}
                for name, data in signal['agent_signals'].items():
                    agent_metrics[name] = {
                        'signal': data.get('signal_strength', 0),
                        'confidence': data.get('confidence', 0)
                    }
                metrics.record_agent_signals(symbol, agent_metrics)

            # --- GRAFANA TELEMETRY ---
            # Fire-and-forget write to QuestDB
            try:
                ts = datetime.utcnow()
                # Prediction: timestamp, symbol, prob
                # CRITICAL: specific cast to float to avoid np.float64 error in psycopg2
                confidence = float(signal.get('confidence', 0.0))
                
                # --- GRAFANA FILTER ---
                # User Requirement: "Day Moves"
                # - Strict Buy/Strong Buy: The "Call" signals
                # - Positive Hold (> 0.1): The "Watchlist" signals
                # - Filter out all Negative signals (Sells/Bearish) as they are noise
                
                action = signal.get('action', 'hold')
                sig_strength = float(signal.get('signal_strength', 0.0))
                
                # Logic: Either a Buy action OR a Positive Signal (Watchlist)
                is_buy = action in ['buy', 'strong_buy']
                is_watchlist = (action == 'hold' and sig_strength > 0.1)
                
                if is_buy or is_watchlist:
                    pred_row = (ts, symbol, confidence)
                    
                    # Features: timestamp, symbol, atr, volatility
                    feat_row = (
                        ts, 
                        symbol, 
                        float(result.get('atr', 0.0)), 
                        float(result.get('volatility_20', 0.0))
                    )
                    
                    if hasattr(self, 'db_writer') and self.db_writer:
                        self.db_writer.write(pred_row, feat_row)
            except Exception as e:
                logger.error("telemetry_write_failed", error=str(e))
            # -------------------------

            
            # Reconstruct FusedSignal for gating
            from fusion.ensemble import FusedSignal
            fused = FusedSignal(
                signal_strength=signal.get('signal_strength', 0),
                direction=signal.get('direction', 0),
                confidence=signal.get('confidence', 0),
                regime=signal.get('regime', 'unknown'),
                agent_signals={},
                agreement_score=signal.get('agreement_score', 0),
                weighted_contributions={},
                action=signal.get('action', 'hold')
            )
            
            # Publish raw signal (before filtering)
            await self.router.publish_raw_signal(symbol, fused)
            
            # Confidence gate
            passed, reason = self.confidence_gate.gate(fused)
            if not passed:
                await self.router.publish_ui_signal(symbol, fused, None)
                return
            
            # Throttle check
            can_emit, throttle_reason = self.throttler.can_emit(symbol)
            if not can_emit:
                return
            
            # Risk filter
            from fusion.decision_engine import TradeDecision
            trade_decision = TradeDecision(
                symbol=symbol,
                timestamp=datetime.now(),
                action=decision.get('action', 'hold'),
                signal_strength=decision.get('signal_strength', 0),
                confidence=decision.get('confidence', 0),
                position_size_pct=decision.get('position_size_pct', 0),
                risk_pct=decision.get('risk_pct', 0),
                entry_price=decision.get('entry_price'),
                stop_loss=decision.get('stop_loss'),
                take_profit=decision.get('take_profit'),
                regime=decision.get('regime', 'unknown'),
                reason=decision.get('reason', '')
            )
            
            risk_passed, risk_reason = self.risk_filter.check(
                trade_decision,
                current_volatility=result.get('atr', 0)
            )
            if not risk_passed:
                return
            
            # All filters passed - emit signal
            if trade_decision.action not in ['hold']:
                self.throttler.record_signal(symbol)
                await self.router.publish_live_signal(symbol, trade_decision)
                self.signals_generated += 1
            
            # Always publish UI signal
            await self.router.publish_ui_signal(symbol, fused, trade_decision)
            
        except Exception as e:
            logger.error("inference_error", symbol=symbol, error=str(e))
    
    def add_symbol(self, symbol: str) -> None:
        """Add symbol to track."""
        logger.info("adding_symbol", symbol=symbol)
        self.symbols.add(symbol)
        if symbol not in self.bar_engines:
            self.bar_engines[symbol] = BarEngineManager(symbol)
            self.bar_engines[symbol].add_engine(
                f"time_{self.bar_interval}s",
                TimeBarEngine(symbol=symbol, interval_seconds=self.bar_interval)
            )
            self.bars_buffer[symbol] = []
            
            # Backfill history
            try:
                self._backfill_history(symbol)
            except Exception as e:
                logger.error("backfill_failed", symbol=symbol, error=str(e))

    def _backfill_history(self, symbol: str) -> None:
        """Fetch historical bars from DB."""
        # Calculate window
        # needed_seconds = self.bar_interval * self.min_bars_for_features * 2 # Reduced for testing
        
        # Use 24h window to ensure we get data even if market was closed/paused
        start_time = datetime.now() - timedelta(days=1)
        end_time = datetime.now()
        
        try:
            df = self.exporter.export_bars(
                symbol=symbol,
                start=start_time,
                end=end_time,
                format="dataframe"
            )
            
            if df is not None and not df.empty:
                # Convert to dicts
                bars = df.to_dict('records')
                # Add to buffer
                self.bars_buffer[symbol].extend(bars)
                logger.info("backfilled_bars", symbol=symbol, count=len(bars))
        except Exception as e:
            logger.warning("backfill_error", symbol=symbol, error=str(e))
    
    def remove_symbol(self, symbol: str) -> None:
        """Remove symbol from tracking."""
        self.symbols.discard(symbol)
    
    def get_stats(self) -> dict:
        """Get inference statistics."""
        return {
            'running': self.running,
            'symbols': list(self.symbols),
            'ticks_processed': self.ticks_processed,
            'signals_generated': self.signals_generated,
            'last_tick_times': {
                k: v.isoformat() for k, v in self.last_tick_time.items()
            },
            'confidence_gate': self.confidence_gate.get_stats(),
            'throttler': self.throttler.get_stats(),
            'risk_filter': self.risk_filter.get_stats(),
            'router': self.router.get_stats()
        }


# Entry point
async def main():
    """Run realtime inference."""
    symbols = {"LUCK", "OGDC", "PPL", "MARI", "HBL"}
    
    engine = RealtimeInference(
        symbols=symbols,
        redis_url=settings.redis_url,
        bar_interval_seconds=60
    )
    
    try:
        await engine.start()
    except KeyboardInterrupt:
        await engine.stop()


if __name__ == "__main__":
    asyncio.run(main())

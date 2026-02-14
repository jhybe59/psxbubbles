"""
Streaming Pipeline Module
Connects Node.js Worker -> Redis PubSub -> Bar Engine -> Feature Engine -> Model

Redis Channel Protocol:
  - ticks.raw.<symbol>     : Raw tick data from worker
  - bars.time.<symbol>     : Time-based bars (1m)
  - bars.volume.<symbol>   : Volume-based bars
  - bars.tick.<symbol>     : Tick-based bars
  - features.live.<symbol> : Computed features
  - signals.live.<symbol>  : Model predictions/signals
"""
import asyncio
import json
from datetime import datetime
from typing import Optional, Callable, Awaitable
import redis.asyncio as redis
import structlog

from config import settings
from schemas import TickData, PredictionResponse
from bar_engine import (
    Tick, Bar, 
    TimeBarEngine, VolumeBarEngine, TickBarEngine,
    MultiBarEngine
)
from features import feature_engine
from models import model_registry

logger = structlog.get_logger()


# ============ REDIS CHANNELS ============

class Channels:
    """Redis channel naming convention."""
    
    @staticmethod
    def ticks_raw(symbol: str) -> str:
        return f"ticks.raw.{symbol}"
    
    @staticmethod
    def bars(bar_type: str, symbol: str) -> str:
        return f"bars.{bar_type}.{symbol}"
    
    @staticmethod
    def features(symbol: str) -> str:
        return f"features.live.{symbol}"
    
    @staticmethod
    def signals(symbol: str) -> str:
        return f"signals.live.{symbol}"
    
    TICKS_PATTERN = "ticks.raw.*"
    BARS_PATTERN = "bars.*.*"
    FEATURES_PATTERN = "features.live.*"
    SIGNALS_PATTERN = "signals.live.*"


# ============ MESSAGE SCHEMAS ============

class TickMessage:
    """Parse tick message from Node.js worker."""
    
    @staticmethod
    def parse(data: str | bytes) -> Optional[Tick]:
        try:
            if isinstance(data, bytes):
                data = data.decode('utf-8')
            
            msg = json.loads(data)
            
            return Tick(
                timestamp=datetime.fromisoformat(msg['timestamp'].replace('Z', '+00:00')),
                symbol=msg['symbol'],
                price=float(msg['price']),
                volume=float(msg['volume']),
                side=msg.get('side')
            )
        except Exception as e:
            logger.warning("tick_parse_error", error=str(e), data=data[:100] if data else None)
            return None
    
    @staticmethod
    def serialize(tick: Tick) -> str:
        return json.dumps({
            "timestamp": tick.timestamp.isoformat(),
            "symbol": tick.symbol,
            "price": tick.price,
            "volume": tick.volume,
            "side": tick.side
        })


class BarMessage:
    """Serialize bar for Redis."""
    
    @staticmethod
    def serialize(bar: Bar) -> str:
        return json.dumps(bar.to_dict())
    
    @staticmethod
    def parse(data: str | bytes) -> Optional[dict]:
        try:
            if isinstance(data, bytes):
                data = data.decode('utf-8')
            return json.loads(data)
        except:
            return None


# ============ STREAM PROCESSOR ============

class StreamProcessor:
    """
    Main streaming pipeline processor.
    
    Flow:
    1. Subscribe to ticks.raw.*
    2. Feed ticks to Bar Engines
    3. On bar completion -> compute features
    4. Feed features to model -> get prediction
    5. Publish signals to signals.live.*
    """
    
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
        self.pubsub: Optional[redis.client.PubSub] = None
        
        # Bar engines per symbol (will be created on first tick)
        self.bar_engines: dict[str, MultiBarEngine] = {}
        
        # Feature buffers per symbol (need multiple bars for features)
        self.bar_buffers: dict[str, list[Bar]] = {}
        self.buffer_size = settings.feature_window + 10  # Rolling buffer
        
        # Callbacks
        self._on_bar: Optional[Callable[[str, Bar], Awaitable[None]]] = None
        self._on_signal: Optional[Callable[[str, PredictionResponse], Awaitable[None]]] = None
        
        # Stats
        self.stats = {
            "ticks_received": 0,
            "bars_emitted": 0,
            "signals_generated": 0,
            "errors": 0
        }
    
    async def connect(self) -> None:
        """Connect to Redis."""
        self.redis = await redis.from_url(settings.redis_url)
        self.pubsub = self.redis.pubsub()
        logger.info("stream_processor_connected", redis_url=settings.redis_url)
    
    async def subscribe(self, pattern: str = Channels.TICKS_PATTERN) -> None:
        """Subscribe to tick channels."""
        await self.pubsub.psubscribe(pattern)
        logger.info("subscribed", pattern=pattern)
    
    def _get_or_create_engines(self, symbol: str) -> MultiBarEngine:
        """Get or create bar engines for a symbol."""
        if symbol not in self.bar_engines:
            multi = MultiBarEngine(symbol)
            
            # Add different bar types
            multi.add_engine("time_1m", TimeBarEngine(symbol, interval_seconds=60))
            multi.add_engine("time_5s", TimeBarEngine(symbol, interval_seconds=5))
            multi.add_engine("volume", VolumeBarEngine(symbol, volume_threshold=5000))
            multi.add_engine("tick", TickBarEngine(symbol, tick_threshold=20))
            
            self.bar_engines[symbol] = multi
            self.bar_buffers[symbol] = []
            
            logger.info("engines_created", symbol=symbol)
        
        return self.bar_engines[symbol]
    
    async def _process_tick(self, tick: Tick) -> None:
        """Process a single tick through the pipeline."""
        self.stats["ticks_received"] += 1
        
        # Get bar engines
        engines = self._get_or_create_engines(tick.symbol)
        
        # Process through all engines
        completed_bars = engines.add_tick(tick)
        
        for bar_type, bar in completed_bars.items():
            self.stats["bars_emitted"] += 1
            
            # Publish bar
            channel = Channels.bars(bar_type, bar.symbol)
            await self.redis.publish(channel, BarMessage.serialize(bar))
            
            # Callback
            if self._on_bar:
                await self._on_bar(bar_type, bar)
            
            # Add to buffer for feature computation (use time_1m bars)
            if bar_type == "time_1m":
                buffer = self.bar_buffers[bar.symbol]
                buffer.append(bar)
                
                # Trim buffer
                if len(buffer) > self.buffer_size:
                    buffer.pop(0)
                
                # Check if we can compute features
                if len(buffer) >= settings.feature_window:
                    await self._compute_and_predict(bar.symbol)
    
    async def _compute_and_predict(self, symbol: str) -> None:
        """Compute features and run prediction."""
        try:
            import pandas as pd
            
            buffer = self.bar_buffers[symbol]
            
            # Convert bars to DataFrame
            df = pd.DataFrame([{
                "timestamp": b.end_time,
                "open": b.open,
                "high": b.high,
                "low": b.low,
                "close": b.close,
                "volume": b.volume
            } for b in buffer])
            df.set_index("timestamp", inplace=True)
            
            # Compute features
            df_features = feature_engine.compute_features(df, symbol)
            
            if df_features.empty:
                return
            
            # Get latest features
            latest = df_features.iloc[-1]
            feature_cols = feature_engine.get_feature_names()
            X = [[latest[col] for col in feature_cols]]
            
            # Get model and predict
            model = model_registry.get(settings.model_name)
            if model:
                import numpy as np
                prob = model.predict(np.array(X))[0]
                
                # Determine signal
                if prob >= settings.prediction_threshold:
                    direction = "up" if latest['return_1'] > 0 else "down"
                    strength = "strong" if prob >= 0.8 else "moderate"
                    
                    signal = PredictionResponse(
                        symbol=symbol,
                        timestamp=datetime.utcnow(),
                        move_probability=float(prob),
                        direction=direction,
                        confidence=float(prob),
                        signal_strength=strength,
                        recommended_action="alert"
                    )
                    
                    # Publish signal
                    channel = Channels.signals(symbol)
                    await self.redis.publish(channel, signal.model_dump_json())
                    
                    self.stats["signals_generated"] += 1
                    logger.info("signal_generated", 
                                symbol=symbol, 
                                probability=prob, 
                                direction=direction)
                    
                    if self._on_signal:
                        await self._on_signal(symbol, signal)
                        
        except Exception as e:
            self.stats["errors"] += 1
            logger.error("prediction_error", symbol=symbol, error=str(e))
    
    async def run(self) -> None:
        """Main processing loop."""
        logger.info("stream_processor_started")
        
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "pmessage":
                    tick = TickMessage.parse(message["data"])
                    if tick:
                        await self._process_tick(tick)
                        
        except asyncio.CancelledError:
            logger.info("stream_processor_cancelled")
        except Exception as e:
            logger.error("stream_processor_error", error=str(e))
            raise
    
    async def close(self) -> None:
        """Clean shutdown."""
        # Flush all bar engines
        for symbol, engines in self.bar_engines.items():
            final_bars = engines.flush_all()
            for bar_type, bar in final_bars.items():
                if bar:
                    channel = Channels.bars(bar_type, bar.symbol)
                    await self.redis.publish(channel, BarMessage.serialize(bar))
        
        if self.pubsub:
            await self.pubsub.close()
        if self.redis:
            await self.redis.close()
        
        logger.info("stream_processor_closed", stats=self.stats)
    
    def on_bar(self, callback: Callable[[str, Bar], Awaitable[None]]) -> None:
        """Register callback for bar events."""
        self._on_bar = callback
    
    def on_signal(self, callback: Callable[[str, PredictionResponse], Awaitable[None]]) -> None:
        """Register callback for signal events."""
        self._on_signal = callback


# ============ STANDALONE RUNNER ============

async def main():
    """Run stream processor standalone."""
    processor = StreamProcessor()
    
    try:
        await processor.connect()
        await processor.subscribe()
        
        # Log stats periodically
        async def stats_logger():
            while True:
                await asyncio.sleep(60)
                logger.info("stream_stats", **processor.stats)
        
        asyncio.create_task(stats_logger())
        
        await processor.run()
        
    finally:
        await processor.close()


if __name__ == "__main__":
    asyncio.run(main())

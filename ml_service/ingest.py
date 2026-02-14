"""
Data Ingestion Module
- Fetches historical data from QuestDB
- Subscribes to real-time ticks via Redis
- Converts ticks to bars (time/volume/tick bars)
"""
import asyncio
from datetime import datetime, timedelta
from typing import AsyncGenerator, Optional
import pandas as pd
import redis.asyncio as redis
import structlog
from sqlalchemy import create_engine, text

from config import settings
from schemas import TickData, BarData, StreamMessage

logger = structlog.get_logger()


class QuestDBClient:
    """Client for fetching historical data from QuestDB."""
    
    def __init__(self):
        self.engine = create_engine(settings.questdb_dsn)
    
    def fetch_bars(
        self,
        symbol: str,
        start: datetime,
        end: datetime,
        table: str = "minute_bars"
    ) -> pd.DataFrame:
        """Fetch OHLCV bars from QuestDB."""
        query = text(f"""
            SELECT 
                timestamp,
                open,
                high,
                low,
                close,
                volume
            FROM {table}
            WHERE symbol = :symbol
              AND timestamp >= :start
              AND timestamp < :end
            ORDER BY timestamp ASC
        """)
        
        with self.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={
                "symbol": symbol,
                "start": start,
                "end": end
            })
        
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df.set_index('timestamp', inplace=True)
        logger.info("fetched_bars", symbol=symbol, rows=len(df))
        return df
    
    def fetch_ticks(
        self,
        symbol: str,
        start: datetime,
        end: datetime,
        table: str = "trades"
    ) -> pd.DataFrame:
        """Fetch raw tick/trade data from QuestDB."""
        query = text(f"""
            SELECT 
                timestamp,
                price,
                volume
            FROM {table}
            WHERE symbol = :symbol
              AND timestamp >= :start
              AND timestamp < :end
            ORDER BY timestamp ASC
        """)
        
        with self.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={
                "symbol": symbol,
                "start": start,
                "end": end
            })
        
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        logger.info("fetched_ticks", symbol=symbol, rows=len(df))
        return df
    
    def get_symbols(self) -> list[str]:
        """Get list of available symbols."""
        query = text("SELECT DISTINCT symbol FROM minute_bars")
        with self.engine.connect() as conn:
            result = conn.execute(query)
            return [row[0] for row in result]


class RedisStreamClient:
    """Client for real-time data via Redis Pub/Sub."""
    
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
        self.pubsub: Optional[redis.client.PubSub] = None
    
    async def connect(self):
        """Establish Redis connection."""
        self.redis = redis.from_url(settings.redis_url)
        self.pubsub = self.redis.pubsub()
        logger.info("redis_connected", url=settings.redis_url)
    
    async def subscribe(self, channel: str = "ticks:*") -> AsyncGenerator[StreamMessage, None]:
        """Subscribe to tick stream and yield messages."""
        await self.pubsub.psubscribe(channel)
        logger.info("subscribed", channel=channel)
        
        async for message in self.pubsub.listen():
            if message["type"] == "pmessage":
                try:
                    data = StreamMessage.model_validate_json(message["data"])
                    yield data
                except Exception as e:
                    logger.warning("parse_error", error=str(e))
    
    async def publish(self, channel: str, message: StreamMessage):
        """Publish prediction or alert to Redis."""
        await self.redis.publish(channel, message.model_dump_json())
    
    async def close(self):
        """Close Redis connections."""
        if self.pubsub:
            await self.pubsub.close()
        if self.redis:
            await self.redis.close()


class BarAggregator:
    """Aggregates ticks into bars (time, volume, or tick-based)."""
    
    def __init__(self, bar_type: str = "time", interval: int = 60):
        self.bar_type = bar_type
        self.interval = interval  # seconds for time, count for tick/volume
        self.buffer: dict[str, list[TickData]] = {}
    
    def add_tick(self, tick: TickData) -> Optional[BarData]:
        """Add tick and return bar if complete."""
        symbol = tick.symbol
        if symbol not in self.buffer:
            self.buffer[symbol] = []
        
        self.buffer[symbol].append(tick)
        
        if self._should_emit_bar(symbol):
            return self._emit_bar(symbol)
        return None
    
    def _should_emit_bar(self, symbol: str) -> bool:
        """Check if we should emit a bar."""
        ticks = self.buffer[symbol]
        if not ticks:
            return False
        
        if self.bar_type == "time":
            first_ts = ticks[0].timestamp
            last_ts = ticks[-1].timestamp
            return (last_ts - first_ts).total_seconds() >= self.interval
        
        elif self.bar_type == "tick":
            return len(ticks) >= self.interval
        
        elif self.bar_type == "volume":
            total_vol = sum(t.volume for t in ticks)
            return total_vol >= self.interval
        
        return False
    
    def _emit_bar(self, symbol: str) -> BarData:
        """Create bar from buffered ticks and clear buffer."""
        ticks = self.buffer[symbol]
        prices = [t.price for t in ticks]
        volumes = [t.volume for t in ticks]
        
        bar = BarData(
            symbol=symbol,
            timestamp=ticks[-1].timestamp,
            open=prices[0],
            high=max(prices),
            low=min(prices),
            close=prices[-1],
            volume=sum(volumes),
            vwap=sum(p * v for p, v in zip(prices, volumes)) / sum(volumes) if sum(volumes) > 0 else prices[-1],
            trade_count=len(ticks)
        )
        
        self.buffer[symbol] = []
        return bar


# Convenience instances
questdb = QuestDBClient()

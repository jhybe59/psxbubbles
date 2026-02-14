"""
Bar Engine Module
Converts raw ticks into various bar types:
- Time Bars (1s, 5s, 1m, etc.)
- Volume Bars (fixed volume per bar)
- Tick Bars (fixed number of ticks per bar)
- Dollar Bars (fixed dollar volume per bar)

This is the CRITICAL signal quality layer.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Literal
import numpy as np
import pandas as pd
import structlog

logger = structlog.get_logger()


@dataclass
class Tick:
    """Raw tick/trade data."""
    timestamp: datetime
    symbol: str
    price: float
    volume: float
    side: Optional[Literal["buy", "sell"]] = None


@dataclass 
class Bar:
    """OHLCV Bar with metadata."""
    symbol: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    vwap: float
    ticks: int
    start_time: datetime
    end_time: datetime
    
    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
            "vwap": self.vwap,
            "ticks": self.ticks,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
        }


class BaseBarEngine(ABC):
    """Abstract base class for bar engines."""
    
    def __init__(self, symbol: str):
        self.symbol = symbol
        self._buffer: list[Tick] = []
    
    @abstractmethod
    def should_emit(self) -> bool:
        """Check if a bar should be emitted."""
        pass
    
    def add_tick(self, tick: Tick) -> Optional[Bar]:
        """Add a tick and return bar if complete."""
        if tick.symbol != self.symbol:
            return None
        
        self._buffer.append(tick)
        
        if self.should_emit():
            return self._emit_bar()
        return None
    
    def _emit_bar(self) -> Bar:
        """Create bar from buffer and clear."""
        if not self._buffer:
            raise ValueError("Cannot emit bar from empty buffer")
        
        prices = [t.price for t in self._buffer]
        volumes = [t.volume for t in self._buffer]
        
        total_volume = sum(volumes)
        vwap = sum(p * v for p, v in zip(prices, volumes)) / total_volume if total_volume > 0 else prices[-1]
        
        bar = Bar(
            symbol=self.symbol,
            open=prices[0],
            high=max(prices),
            low=min(prices),
            close=prices[-1],
            volume=total_volume,
            vwap=vwap,
            ticks=len(self._buffer),
            start_time=self._buffer[0].timestamp,
            end_time=self._buffer[-1].timestamp,
        )
        
        self._buffer = []
        return bar
    
    def flush(self) -> Optional[Bar]:
        """Force emit any remaining buffer (for end of day)."""
        if self._buffer:
            return self._emit_bar()
        return None


class TimeBarEngine(BaseBarEngine):
    """
    Time-based bars (fixed time intervals).
    
    Examples:
        - 1 second bars: TimeBarEngine("LUCK", interval_seconds=1)
        - 1 minute bars: TimeBarEngine("LUCK", interval_seconds=60)
    """
    
    def __init__(self, symbol: str, interval_seconds: int = 60):
        super().__init__(symbol)
        self.interval_seconds = interval_seconds
        self._current_bar_end: Optional[datetime] = None
    
    def should_emit(self) -> bool:
        if not self._buffer:
            return False
        
        first_tick = self._buffer[0]
        last_tick = self._buffer[-1]
        
        # Calculate bar boundaries
        if self._current_bar_end is None:
            # Align to interval boundary
            ts = first_tick.timestamp
            interval = timedelta(seconds=self.interval_seconds)
            bar_start = ts.replace(microsecond=0)
            # Round down to nearest interval
            seconds = bar_start.second + bar_start.minute * 60 + bar_start.hour * 3600
            aligned_seconds = (seconds // self.interval_seconds) * self.interval_seconds
            bar_start = bar_start.replace(
                hour=aligned_seconds // 3600,
                minute=(aligned_seconds % 3600) // 60,
                second=aligned_seconds % 60
            )
            self._current_bar_end = bar_start + interval
        
        return last_tick.timestamp >= self._current_bar_end
    
    def _emit_bar(self) -> Bar:
        bar = super()._emit_bar()
        self._current_bar_end = None  # Reset for next bar
        return bar


class VolumeBarEngine(BaseBarEngine):
    """
    Volume-based bars (fixed volume per bar).
    
    Adapts to market activity - more bars during high volume.
    Better for capturing information content per bar.
    
    Example:
        VolumeBarEngine("LUCK", volume_threshold=10000)
    """
    
    def __init__(self, symbol: str, volume_threshold: float = 10000):
        super().__init__(symbol)
        self.volume_threshold = volume_threshold
    
    def should_emit(self) -> bool:
        if not self._buffer:
            return False
        
        total_volume = sum(t.volume for t in self._buffer)
        return total_volume >= self.volume_threshold


class TickBarEngine(BaseBarEngine):
    """
    Tick-based bars (fixed number of trades per bar).
    
    Samples every N transactions, regardless of size.
    
    Example:
        TickBarEngine("LUCK", tick_threshold=50)
    """
    
    def __init__(self, symbol: str, tick_threshold: int = 50):
        super().__init__(symbol)
        self.tick_threshold = tick_threshold
    
    def should_emit(self) -> bool:
        return len(self._buffer) >= self.tick_threshold


class DollarBarEngine(BaseBarEngine):
    """
    Dollar-based bars (fixed dollar volume per bar).
    
    Dollar volume = price × volume
    Most robust to price changes over time.
    
    Example:
        DollarBarEngine("LUCK", dollar_threshold=1000000)
    """
    
    def __init__(self, symbol: str, dollar_threshold: float = 1_000_000):
        super().__init__(symbol)
        self.dollar_threshold = dollar_threshold
    
    def should_emit(self) -> bool:
        if not self._buffer:
            return False
        
        dollar_volume = sum(t.price * t.volume for t in self._buffer)
        return dollar_volume >= self.dollar_threshold


class BarEngineFactory:
    """Factory for creating bar engines."""
    
    @staticmethod
    def create(
        symbol: str,
        bar_type: Literal["time", "volume", "tick", "dollar"],
        **kwargs
    ) -> BaseBarEngine:
        """Create a bar engine of the specified type."""
        engines = {
            "time": TimeBarEngine,
            "volume": VolumeBarEngine,
            "tick": TickBarEngine,
            "dollar": DollarBarEngine,
        }
        
        if bar_type not in engines:
            raise ValueError(f"Unknown bar type: {bar_type}")
        
        return engines[bar_type](symbol, **kwargs)


class MultiBarEngine:
    """
    Manages multiple bar engines for a single symbol.
    Useful for generating different bar types simultaneously.
    """
    
    def __init__(self, symbol: str):
        self.symbol = symbol
        self.engines: dict[str, BaseBarEngine] = {}
    
    def add_engine(self, name: str, engine: BaseBarEngine) -> None:
        """Add a named bar engine."""
        self.engines[name] = engine
    
    def add_tick(self, tick: Tick) -> dict[str, Optional[Bar]]:
        """Process tick through all engines, return any completed bars."""
        results = {}
        for name, engine in self.engines.items():
            bar = engine.add_tick(tick)
            if bar:
                results[name] = bar
        return results
    
    def flush_all(self) -> dict[str, Optional[Bar]]:
        """Flush all engines."""
        results = {}
        for name, engine in self.engines.items():
            bar = engine.flush()
            if bar:
                results[name] = bar
        return results


# Alias for backward compatibility
BarEngineManager = MultiBarEngine


def process_ticks_to_bars(
    ticks_df: pd.DataFrame,
    symbol: str,
    bar_type: Literal["time", "volume", "tick", "dollar"] = "time",
    **kwargs
) -> pd.DataFrame:
    """
    Batch convert tick DataFrame to bars.
    
    Args:
        ticks_df: DataFrame with timestamp, price, volume columns
        symbol: Symbol name
        bar_type: Type of bar engine to use
        **kwargs: Parameters for the bar engine
        
    Returns:
        DataFrame of bars
    """
    engine = BarEngineFactory.create(symbol, bar_type, **kwargs)
    bars = []
    
    for _, row in ticks_df.iterrows():
        tick = Tick(
            timestamp=pd.to_datetime(row['timestamp']),
            symbol=symbol,
            price=float(row['price']),
            volume=float(row['volume']),
            side=row.get('side')
        )
        bar = engine.add_tick(tick)
        if bar:
            bars.append(bar.to_dict())
    
    # Flush remaining
    final_bar = engine.flush()
    if final_bar:
        bars.append(final_bar.to_dict())
    
    if not bars:
        return pd.DataFrame()
    
    df = pd.DataFrame(bars)
    df['start_time'] = pd.to_datetime(df['start_time'])
    df['end_time'] = pd.to_datetime(df['end_time'])
    
    logger.info("bars_generated", 
                symbol=symbol, 
                bar_type=bar_type, 
                count=len(df))
    return df


# CLI for testing
if __name__ == "__main__":
    # Example usage
    import argparse
    from export import DataExporter
    from datetime import datetime, timedelta
    
    parser = argparse.ArgumentParser(description="Generate bars from ticks")
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--days", type=int, default=1)
    parser.add_argument("--bar-type", choices=["time", "volume", "tick", "dollar"], default="time")
    parser.add_argument("--interval", type=int, default=60, help="Time interval (seconds)")
    parser.add_argument("--threshold", type=float, help="Volume/tick/dollar threshold")
    args = parser.parse_args()
    
    exporter = DataExporter()
    end = datetime.now()
    start = end - timedelta(days=args.days)
    
    ticks_df = exporter.export_ticks(args.symbol, start, end, format="dataframe")
    if ticks_df is not None:
        kwargs = {}
        if args.bar_type == "time":
            kwargs["interval_seconds"] = args.interval
        elif args.threshold:
            key = {"volume": "volume_threshold", "tick": "tick_threshold", "dollar": "dollar_threshold"}
            kwargs[key[args.bar_type]] = args.threshold
        
        bars_df = process_ticks_to_bars(
            ticks_df, 
            args.symbol, 
            bar_type=args.bar_type,
            **kwargs
        )
        print(bars_df.head(20))
        print(f"\nTotal bars: {len(bars_df)}")

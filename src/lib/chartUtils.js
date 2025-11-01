// Utility functions to build lightweight-charts series from snapshot arrays
// snapshots: [{ ts: ms, price, volume, open?, high?, low?, close? , raw? }, ...]

export function buildLineSeriesFromSnapshots(snapshots) {
  if (!snapshots || !snapshots.length) return [];
  return snapshots
    .filter((p) => p && p.price != null && Number.isFinite(Number(p.price)))
    .map((p) => ({ time: Math.floor(p.ts / 1000), value: Number(p.price) }));
}

// Build candlesticks by bucketing snapshots into periodMs windows.
// If periodMs is 0 or not provided, treat each snapshot as its own candle.
export function buildCandlesFromSnapshots(snapshots, periodMs = 0) {
  if (!snapshots || !snapshots.length) return [];
  // ensure sorted ascending
  const arr = snapshots.slice().sort((a, b) => a.ts - b.ts);

  if (!periodMs || periodMs <= 0) {
    // If snapshots already contain OHLC fields use them; otherwise set o=h=l=c = price
    return arr
      .map((r) => ({
        time: Math.floor(r.ts / 1000),
        open: r.open != null ? Number(r.open) : Number(r.price),
        high: r.high != null ? Number(r.high) : Number(r.price),
        low: r.low != null ? Number(r.low) : Number(r.price),
        close: r.close != null ? Number(r.close) : Number(r.price),
        volume: Number(r.volume || 0)
      }));
  }

  const buckets = new Map();
  for (const s of arr) {
    const bucketStart = Math.floor(s.ts / periodMs) * periodMs;
    let b = buckets.get(bucketStart);
    if (!b) {
      b = { open: s.price, high: s.price, low: s.price, close: s.price, ts: bucketStart, volume: Number(s.volume || 0) };
      buckets.set(bucketStart, b);
    } else {
      b.high = Math.max(b.high, s.price);
      b.low = Math.min(b.low, s.price);
      b.close = s.price;
      b.volume = (b.volume || 0) + Number(s.volume || 0);
    }
  }

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucketStart, b]) => ({
      time: Math.floor(bucketStart / 1000),
      open: Number(b.open),
      high: Number(b.high),
      low: Number(b.low),
      close: Number(b.close),
      volume: Number(b.volume || 0)
    }));
}

export function buildVolumeSeriesFromCandles(candles) {
  if (!candles || !candles.length) return [];
  return candles.map((c) => ({ time: c.time, value: Number(c.volume || 0) }));
}

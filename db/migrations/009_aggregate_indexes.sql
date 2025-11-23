-- Indexes for continuous aggregates to optimize query performance
-- These indexes improve query performance when filtering by symbol and/or time range

-- 5-minute aggregate indexes
CREATE INDEX IF NOT EXISTS minute_bars_5m_symbol_bucket_idx 
  ON minute_bars_5m (symbol, bucket DESC);

CREATE INDEX IF NOT EXISTS minute_bars_5m_bucket_idx 
  ON minute_bars_5m (bucket DESC);

-- 15-minute aggregate indexes
CREATE INDEX IF NOT EXISTS minute_bars_15m_symbol_bucket_idx 
  ON minute_bars_15m (symbol, bucket DESC);

CREATE INDEX IF NOT EXISTS minute_bars_15m_bucket_idx 
  ON minute_bars_15m (bucket DESC);

-- 1-hour aggregate indexes
CREATE INDEX IF NOT EXISTS minute_bars_1h_symbol_bucket_idx 
  ON minute_bars_1h (symbol, bucket DESC);

CREATE INDEX IF NOT EXISTS minute_bars_1h_bucket_idx 
  ON minute_bars_1h (bucket DESC);

-- 4-hour aggregate indexes
CREATE INDEX IF NOT EXISTS minute_bars_4h_symbol_bucket_idx 
  ON minute_bars_4h (symbol, bucket DESC);

CREATE INDEX IF NOT EXISTS minute_bars_4h_bucket_idx 
  ON minute_bars_4h (bucket DESC);

-- 1-day aggregate indexes
CREATE INDEX IF NOT EXISTS minute_bars_1d_symbol_bucket_idx 
  ON minute_bars_1d (symbol, bucket DESC);

CREATE INDEX IF NOT EXISTS minute_bars_1d_bucket_idx 
  ON minute_bars_1d (bucket DESC);

-- 1-week aggregate indexes
CREATE INDEX IF NOT EXISTS minute_bars_1w_symbol_bucket_idx 
  ON minute_bars_1w (symbol, bucket DESC);

CREATE INDEX IF NOT EXISTS minute_bars_1w_bucket_idx 
  ON minute_bars_1w (bucket DESC);

-- 1-month aggregate indexes
CREATE INDEX IF NOT EXISTS minute_bars_1mo_symbol_bucket_idx 
  ON minute_bars_1mo (symbol, bucket DESC);

CREATE INDEX IF NOT EXISTS minute_bars_1mo_bucket_idx 
  ON minute_bars_1mo (bucket DESC);

-- 1-year aggregate indexes
CREATE INDEX IF NOT EXISTS minute_bars_1y_symbol_bucket_idx 
  ON minute_bars_1y (symbol, bucket DESC);

CREATE INDEX IF NOT EXISTS minute_bars_1y_bucket_idx 
  ON minute_bars_1y (bucket DESC);


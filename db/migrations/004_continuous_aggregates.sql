-- Continuous aggregates for different intervals
CREATE MATERIALIZED VIEW IF NOT EXISTS minute_bars_5m
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  time_bucket('5 minutes', ts) AS bucket,
  first(open, ts) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, ts) AS close,
  sum(volume) AS volume_sum,
  sum(value) AS turnover_sum,
  last(daily_pct, ts) AS daily_pct,
  (last(close, ts) - first(open, ts)) / NULLIF(first(open, ts), 0) * 100 AS pct_change
FROM minute_bars
GROUP BY symbol, bucket;

CREATE MATERIALIZED VIEW IF NOT EXISTS minute_bars_15m
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  time_bucket('15 minutes', ts) AS bucket,
  first(open, ts) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, ts) AS close,
  sum(volume) AS volume_sum,
  sum(value) AS turnover_sum,
  last(daily_pct, ts) AS daily_pct,
  (last(close, ts) - first(open, ts)) / NULLIF(first(open, ts), 0) * 100 AS pct_change
FROM minute_bars
GROUP BY symbol, bucket;

CREATE MATERIALIZED VIEW IF NOT EXISTS minute_bars_1h
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  time_bucket('1 hour', ts) AS bucket,
  first(open, ts) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, ts) AS close,
  sum(volume) AS volume_sum,
  sum(value) AS turnover_sum,
  last(daily_pct, ts) AS daily_pct,
  (last(close, ts) - first(open, ts)) / NULLIF(first(open, ts), 0) * 100 AS pct_change
FROM minute_bars
GROUP BY symbol, bucket;

CREATE MATERIALIZED VIEW IF NOT EXISTS minute_bars_1d
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  time_bucket('1 day', ts) AS bucket,
  first(open, ts) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, ts) AS close,
  sum(volume) AS volume_sum,
  sum(value) AS turnover_sum,
  last(daily_pct, ts) AS daily_pct,
  (last(close, ts) - first(open, ts)) / NULLIF(first(open, ts), 0) * 100 AS pct_change
FROM minute_bars
GROUP BY symbol, bucket;

SELECT add_continuous_aggregate_policy('minute_bars_5m',
  start_offset => INTERVAL '2 hours',
  end_offset => INTERVAL '0',
  schedule_interval => INTERVAL '1 minute');

SELECT add_continuous_aggregate_policy('minute_bars_15m',
  start_offset => INTERVAL '6 hours',
  end_offset => INTERVAL '0',
  schedule_interval => INTERVAL '5 minutes');

SELECT add_continuous_aggregate_policy('minute_bars_1h',
  start_offset => INTERVAL '2 days',
  end_offset => INTERVAL '0',
  schedule_interval => INTERVAL '15 minutes');

SELECT add_continuous_aggregate_policy('minute_bars_1d',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '0',
  schedule_interval => INTERVAL '1 hour');


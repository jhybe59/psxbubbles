-- Additional continuous aggregates for 4h, 1w, 1m, 1y

CREATE MATERIALIZED VIEW IF NOT EXISTS minute_bars_4h
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  time_bucket('4 hours', ts) AS bucket,
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

CREATE MATERIALIZED VIEW IF NOT EXISTS minute_bars_1w
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  time_bucket('1 week', ts) AS bucket,
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

CREATE MATERIALIZED VIEW IF NOT EXISTS minute_bars_1mo
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  time_bucket('1 month', ts) AS bucket,
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

CREATE MATERIALIZED VIEW IF NOT EXISTS minute_bars_1y
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  time_bucket('1 year', ts) AS bucket,
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

-- Add refresh policies
SELECT add_continuous_aggregate_policy('minute_bars_4h',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '0',
  schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('minute_bars_1w',
  start_offset => INTERVAL '30 days',
  end_offset => INTERVAL '0',
  schedule_interval => INTERVAL '6 hours');

SELECT add_continuous_aggregate_policy('minute_bars_1mo',
  start_offset => INTERVAL '90 days',
  end_offset => INTERVAL '0',
  schedule_interval => INTERVAL '1 day');

SELECT add_continuous_aggregate_policy('minute_bars_1y',
  start_offset => INTERVAL '2 years',
  end_offset => INTERVAL '0',
  schedule_interval => INTERVAL '1 week');


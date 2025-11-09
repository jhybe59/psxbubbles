# Phase 1 – Schema & Database Setup

## TimescaleDB Objects

### Base Hypertable: `minute_bars`
- Columns:
  - `symbol TEXT NOT NULL`
  - `ts TIMESTAMPTZ NOT NULL`
  - `open NUMERIC(18,4)`
  - `high NUMERIC(18,4)`
  - `low NUMERIC(18,4)`
  - `close NUMERIC(18,4)`
  - `volume BIGINT`
  - `daily_pct NUMERIC(9,4)`
  - `turnover NUMERIC(20,2)`
  - `metadata JSONB DEFAULT '{}'::JSONB` (raw payload snapshot, bid/ask, status, corporate flags)
- Constraints & Indexes:
  - Primary key on `(symbol, ts)`.
  - Timescale hypertable partitioned on `ts` with daily chunk interval.
- Policies:
  - Compression enabled after data ages 3 days: `ALTER TABLE minute_bars SET (timescaledb.compress = true);` with order-by `(symbol, ts)` and segment-by `symbol`.
  - Retention policy to drop data older than 45 days.

### Continuous Aggregates

| View | Bucket Interval | Columns |
| --- | --- | --- |
| `minute_bars_5m` | 5 minutes | `symbol`, `bucket`, `open`, `high`, `low`, `close`, `volume_sum`, `pct_change`, `daily_pct` |
| `minute_bars_15m` | 15 minutes | Same as above |
| `minute_bars_1h` | 1 hour | Same as above |
| `minute_bars_1d` | 1 day | `symbol`, `bucket`, `open`, `high`, `low`, `close`, `volume_sum`, `turnover_sum`, `pct_change`, `daily_pct` |

Implementation notes:
- Use `CREATE MATERIALIZED VIEW ... WITH (timescaledb.continuous) AS SELECT symbol, time_bucket(INTERVAL '5 minutes', ts) AS bucket, first(open, ts) AS open, max(high) AS high, min(low) AS low, last(close, ts) AS close, sum(volume) AS volume_sum, sum(turnover) AS turnover_sum, (last(close, ts) - first(open, ts)) / NULLIF(first(open, ts), 0) AS pct_change, last(daily_pct, ts) AS daily_pct FROM minute_bars GROUP BY symbol, bucket;`
- Configure refresh policies: intraday buckets refresh every 5 minutes over trailing 2 days; daily bucket refresh nightly over trailing 30 days.
- Aggregates retention: keep 365 days of data; optionally archive older to cold storage.

### Supporting Tables
- `ingestion_log`: `id UUID`, `symbol`, `ts`, `source`, `ingested_at`, `status`, `error_message`.
- `ingestion_gap_alerts`: track gap detections with `detected_at`, `symbol`, `missing_from`, `missing_to`, `status`.
- `metadata` tables reused from Phase 0 (`instruments`, `index_members`, etc.)

## SQL Bootstrapping Sequence (Pseudo)
```sql
CREATE TABLE minute_bars (...);
SELECT create_hypertable('minute_bars', 'ts', chunk_time_interval => INTERVAL '1 day');

ALTER TABLE minute_bars SET (timescaledb.compress = true);
SELECT add_compression_policy('minute_bars', INTERVAL '3 days');
SELECT add_retention_policy('minute_bars', INTERVAL '45 days');

-- Continuous aggregate example
CREATE MATERIALIZED VIEW minute_bars_5m WITH (timescaledb.continuous) AS
SELECT
  symbol,
  time_bucket(INTERVAL '5 minutes', ts) AS bucket,
  first(open, ts) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, ts) AS close,
  sum(volume) AS volume_sum,
  sum(turnover) AS turnover_sum,
  (last(close, ts) - first(open, ts)) / NULLIF(first(open, ts), 0) AS pct_change,
  last(daily_pct, ts) AS daily_pct
FROM minute_bars
GROUP BY symbol, bucket;

SELECT add_continuous_aggregate_policy('minute_bars_5m',
  start_offset => INTERVAL '2 days',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes');

SELECT add_retention_policy('minute_bars_5m', INTERVAL '365 days');
```

## Validation & Ops Checklist
- Verify index usage on `(symbol, ts)` using `EXPLAIN ANALYZE` for common queries.
- Monitor chunk growth; adjust chunk interval if write pressure dictates.
- Refresh policies monitored via `timescaledb_information.continuous_aggregates`.
- Ensure compression policy cooperates with aggregate refresh windows (avoid compressing data still inside refresh horizon).

## Verification Cheatsheet
- Run migrations from inside the `api` container (ensures network resolution to `timescale` service):
  ```shell
  docker compose -f docker-compose.dev.yml exec api npm run db:migrate
  ```
- Confirm hypertable exists:
  ```sql
  SELECT hypertable_name, dimensions, chunk_interval
  FROM timescaledb_information.hypertables
  WHERE hypertable_name = 'minute_bars';
  ```
- Validate continuous aggregates:
  ```sql
  SELECT view_name, schedule_interval, refresh_start_offset, refresh_end_offset
  FROM timescaledb_information.continuous_aggregates
  WHERE view_name LIKE 'minute_bars_%';
  ```
- Check retention & compression policies:
  ```sql
  SELECT job_id, application_name, schedule_interval, config
  FROM timescaledb_information.jobs
  WHERE application_name IN ('Retention Policy [minute_bars]', 'Compression Policy [minute_bars]');
  ```




# Data Storage & Aggregation Design

## Technology Decision
- Primary store: TimescaleDB (PostgreSQL + Timescale extension) to leverage hypertables, SQL analytics, compression, and continuous aggregates.
- Redis Stack positioned as an optional cache layer (e.g., hot watchlists) but not the system of record for historical minute bars.
- Deployment preference: managed Timescale Cloud for automatic updates, HA, and backups. Self-hosted alternative requires PostgreSQL 15+, Timescale 2.x, and operational ownership of backups and patching.

## Workload & Capacity Assumptions
- Universe ~550 REG equity symbols → ~550 new rows per minute (≈ 792k rows/day).
- Raw minute retention target: 90 days (~71M rows). With compression enabled after 7 days, footprint remains tractable.
- Aggregated views retained for 2 years to power daily/weekly analytics with minimal storage overhead.

## Logical Schema Overview
- `minute_bars` hypertable partitioned by time with symbol dimension:
  - `symbol TEXT`
  - `ts TIMESTAMPTZ`
  - `open NUMERIC(18,4)`
  - `high NUMERIC(18,4)`
  - `low NUMERIC(18,4)`
  - `close NUMERIC(18,4)`
  - `volume BIGINT`
  - `turnover NUMERIC(20,2)`
  - `pct_change NUMERIC(9,4)`
  - `daily_pct NUMERIC(9,4)`
  - `status TEXT`
  - `metadata JSONB` (stores optional bid/ask, vwap, corporate action flags)
  - Primary key / unique index on `(symbol, ts)` to enforce dedupe.
- Chunk interval: 1 day initially; revisit if storage pressure dictates shorter chunks.

## Aggregations & Derived Data
- Continuous aggregate views:
  - `agg_5m`, `agg_15m`, `agg_1h`, `agg_1d`
  - Columns: `symbol`, `bucket` (time bucket), `open`, `high`, `low`, `close`, `volume_sum`, `turnover_sum`, `pct_change`, `daily_pct`.
- Continuous aggregate policies refresh every 5 minutes for intraday buckets and nightly for daily aggregates.
- Additional materialized view: sector/index rollups using `index_members` join for advancers/decliners.

## Metadata Tables
- `instruments(symbol TEXT PRIMARY KEY, name TEXT, sector TEXT, status TEXT, api_uuid TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ)`.
- `indices(code TEXT PRIMARY KEY, name TEXT, description TEXT)`.
- `index_members(index_code TEXT, symbol TEXT, weight NUMERIC(9,4), PRIMARY KEY (index_code, symbol))`.
- `trading_calendar(trade_date DATE PRIMARY KEY, status TEXT, note TEXT)`.
- `corporate_actions(symbol TEXT, action_date DATE, action_type TEXT, ratio NUMERIC(10,4), note TEXT)` (populated when provider supplies updates).

## Retention & Compression Policies
- Apply Timescale retention policy on `minute_bars` to drop data older than 90 days.
- Enable native compression after data ages beyond 7 days; compress order: `(symbol, ts)`.
- Aggregated views retained for 24 months; roll older data into archival storage if needed.
- Consider external cold storage (S3) export for audit/compliance before automatic retention purge.

## Ingestion Workflow
- Minute scheduler fetches data, writes into staging table `raw_minute_ingest` (optional) before upserting into `minute_bars` via `INSERT ... ON CONFLICT`.
- Capture ingestion metadata (`ingested_at`, `source_request_id`, `api_sequence`) for audit.
- Maintain idempotency via unique constraint on `(symbol, ts)`.

## Observability & Maintenance
- Metrics: ingestion lag (Current UTC minute - latest `ts` per symbol), write throughput, query latency for UI endpoints, hypertable chunk statistics.
- Alerts when ingestion lag > 90 seconds, or when missing bars detected in last N minutes.
- Backups:
  - Managed service: leverage automated daily snapshots + PITR.
  - Self-hosted: schedule nightly `pg_dump` plus WAL archiving to object storage (RPO ≤ 5 minutes).
- Disaster recovery: read replica in alternate region or standby cluster with replication delay monitoring.









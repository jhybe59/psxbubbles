# Phase 2 – REST Endpoint Design

## Overview
Express-based API with `/api` prefix serving frontend bubble chart and related UI widgets. TimescaleDB acts as source of truth for minute data and continuous aggregates.

## Core Endpoint: `GET /api/bubbles`
- Query params:
  - `interval` (enum: `1m`, `5m`, `15m`, `1h`, `Day`) – maps to continuous aggregates.
  - `sort` (optional: `pct`, `volume`, `symbol`).
  - `limit` (optional, default 200, max 500).
  - `indices` (optional comma list) to filter by index membership.
  - `favorites` (optional comma list) used for prioritized ordering.
- Response:
  ```json
  {
    "interval": "Day",
    "asOf": "2025-11-07T10:30:00Z",
    "symbols": [
      {
        "symbol": "OGDC",
        "price": 122.45,
        "intervalPct": 0.0325,
        "dailyPct": 0.0451,
        "volume": 1250000,
        "turnover": 152500000,
        "status": "ACTIVE"
      }
    ]
  }
  ```
- Data source mapping:
  - `1m` → `minute_bars`
  - `5m` → `minute_bars_5m`
  - `15m` → `minute_bars_15m`
  - `1h` → `minute_bars_1h`
  - `Day` → `minute_bars_1d`
- Caching:
  - Use Redis cache with 15–30s TTL for `interval=1m`, longer (60–120s) for day aggregates.
  - ETag header derived from `asOf` timestamp + interval.
- Pagination:
  - Default limit suffices for PSX (≤ 600 symbols). Provide `offset` for completeness but frontend typically requests full list.

## New Phase 2 Endpoints

The Phase 2 OpenAPI specification lives at `docs/phase2/api-openapi.yaml`.

### `GET /api/snapshots`
- Returns snapshot of market summary metrics: totals, advancers/decliners, top gainers/losers.
- Query params: `interval`, `index` optional.
- Response includes precomputed counts and aggregated turnover.

### `GET /api/indices`
- Metadata: index code, name, member count.
- Optional `includeMembers=true` to embed member symbols.
- When `includeMembers` is false, members list omitted for lower payload.
- Backed by Timescale continuous aggregates (`index_levels_1d`) plus Redis cache with 60s TTL.

### `GET /api/symbols/:symbol`
- Detail view combining latest minute bar, day stats, and corporate action flags.
- Useful for modal or detailed drawer in frontend.

### `GET /api/market-stats`
- Market breadth analytics: advancers/decliners, total volume/turnover.
- Sector snapshots (performance, turnover, advancers).
- Top gainers/losers arrays trimmed to `limit` (default 10).
- Consumer hook: `useMarketStats(interval, index?)`.
- Redis cache TTL: 55s for 5m interval, 300s for Day. ETag formatted as `<interval>-<scope>-<version>`.
- 304 served when `If-None-Match` matches the latest version to reduce payload.

### `GET /api/watchlists/{watchlistId}`
- Returns watchlist metadata plus symbol snapshots.
- Resolved via materialized Redis hash keyed by watchlist ID populated by worker.

### `GET /api/health`
- Returns ingestion lag, DB status, queue depth for ops dashboards.

## Implementation Notes
- Use parameterized SQL queries with `pg` connection pool.
- All endpoints expect an `x-api-key` header; rotate keys per environment and pair them with frontend `VITE_LIVE_API_KEY`.
- Aggregate query sample:
  ```sql
  SELECT symbol, close AS price, pct_change AS interval_pct,
         daily_pct, volume_sum AS volume, turnover_sum AS turnover,
         status
  FROM minute_bars_1d
  WHERE bucket = (SELECT max(bucket) FROM minute_bars_1d)
  ORDER BY pct_change DESC
  LIMIT $1;
  ```
- Align timezone handling by converting `bucket` to UTC before responding.
- Apply response normalization (ensure decimals to 4 places, use null for missing optional fields).

## Error Handling & Responses
- Use consistent envelope:
  ```json
  { "error": { "code": "INVALID_INTERVAL", "message": "Interval must be one of ..." } }
  ```
- HTTP status codes: `400` for validation, `404` for missing symbol, `500` for internal errors, `503` when Timescale unavailable.

## Rate Limiting & Caching Considerations
- Global rate limit 100 req/min per API key (configured via middleware).
- CDN caching optional for `Day` interval (cache-control `max-age=30`), while minute requests set `Cache-Control: private, max-age=5` to leverage frontend caches without staleness.
- Support conditional requests with `If-None-Match` to reduce payload.
- `/metrics` endpoint exposes Prometheus counters (`psx_api_market_stats_requests_total`, etc.) for dashboards.

## Performance & Pagination
- With ≤ 600 symbols, full payload manageable (< 200 KB). Provide `select` param to allow UI to request subset (e.g., `fields=symbol,intervalPct`).
- For future scaling, design query to accept `offset`/`limit`; ensure index on `(bucket, symbol)` in aggregates.


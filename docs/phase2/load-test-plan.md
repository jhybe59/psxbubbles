# Phase 2 Load Verification Plan

## Goals
- Validate `/api/market-stats` and `/api/market-stats/indices` sustain 100 req/s with <250 ms p95 latency.
- Confirm Redis cache hit rate ≥ 80% during normal traffic.
- Ensure Prometheus metrics (`psx_api_*`) reflect request volume and latency for dashboards.

## Tooling
- **k6** for HTTP load generation (Docker image `grafana/k6`).
- **RedisInsight** to inspect key TTLs and hit/miss counters.
- **Prometheus + Grafana** stack from `docker-compose.dev.yml`.

## Test Matrix
| Scenario | Duration | Target RPS | Notes |
| --- | --- | --- | --- |
| Warm cache ramp | 2 min | 10 → 80 | Gradually increase load to populate Redis. |
| Steady 5m | 5 min | 100 | Constant load against `/api/market-stats?interval=5m`. |
| Indices burst | 2 min | 50 | Concurrent `/api/market-stats/indices` calls. |
| Cold cache | 1 min | 40 | Flush Redis (`FLUSHDB`), rerun to validate miss handling. |

## Success Criteria
- API latency: p95 ≤ 250 ms, p99 ≤ 500 ms (k6 summary + Prometheus histogram).
- Error rate: < 0.1% (HTTP 5xx).
- Redis keys retain TTL (no negative values) and version key updates per ingest cycle.
- Metrics endpoint `/metrics` responds with fresh counters throughout tests.

## Procedure
1. `docker compose -f docker-compose.dev.yml up redis api worker timescale`.
2. Seed data: `npm run db:seed`.
3. Start ingestion worker to populate snapshots (requires mock PSX API running).
4. Run warm-up k6 script (sample provided at `scripts/load/market-stats.js`).
5. Monitor Grafana dashboard (Phase 2 Overview) for cache hits, latency, error spikes.
6. After cold-cache test, verify worker logs show cache repopulation and `psx:analytics:version` bump.

## Reporting
- Export k6 summary JSON.
- Capture Prometheus query results for `psx_api_market_stats_requests_total` and `psx_api_market_stats_duration_seconds`.
- Document issues and remediation in `docs/phase2/test-report.md`.



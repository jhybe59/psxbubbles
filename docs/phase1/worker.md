# Ingestion Worker (Node.js + BullMQ)

## Tech Stack
- Runtime: Node.js 20 LTS
- Queue: BullMQ backed by Redis (ElastiCache / Redis Stack managed service)
- Repeat scheduling handled via BullMQ repeatable jobs (`add` with `repeat.pattern`)
- HTTP client: `axios` with retry interceptors
- Metrics: `prom-client` for Prometheus, structured logging via `pino`

## Responsibilities
1. **Schedule Polls**: enqueue `fetch-minute-bars` job every minute with payload specifying target symbols batch.
2. **API Fetch**: call external REST endpoint with bearer token, batching up to N symbols per request, honoring rate limits.
3. **Deduplication**: apply upsert using `(symbol, ts)`; skip or merge duplicates; log discrepancies.
4. **Backoff & Retry**: exponential backoff for transient errors (429, 503) with jitter; surface permanent failures to alert topic.
5. **Gap Detection**: compare latest bar timestamp per symbol vs expected minute; enqueue alert job when gap exceeds threshold.
6. **Instrumentation**: emit metrics (`ingestion_lag_seconds`, `jobs_failed_total`, `api_latency_ms`), structured logs with correlation IDs.

## BullMQ Structure
- `fetchQueue`: repeatable job scheduled via cron pattern.
- No separate scheduler process is required; the worker registers repeatable jobs on startup.
- Workers run with concurrency tuned via env var (default 4).

### Job Flow
```text
Repeatable job (cron) → fetchQueue (load minute bars) → worker fetches API → validate → insert into Timescale → record metrics
```

## Configuration
- Environment variables: `PSX_API_BASE_URL`, `PSX_API_TOKEN`, `TIMESCALE_HOST/PORT/DB/USER/PASSWORD`, `REDIS_URL`, `PSX_API_BATCH_SIZE`, `WORKER_MAX_RETRIES`, `PSX_API_TIMEOUT_MS`.
- Secrets sourced from environment-specific secrets manager.
- Symbol universe cached locally (refresh daily) to avoid requesting delisted symbols (see `scripts/seed-dev.js` for sample data).

## Persistence Layer
- Use `pg` or `postgres.js` client with connection pooling.
- Upsert pattern:
  ```sql
  INSERT INTO minute_bars (...) VALUES (...)
  ON CONFLICT (symbol, ts) DO UPDATE SET ... RETURNING ts;
  ```
- Wrap writes in transaction per batch for atomicity.

## Alerts & Logging
- Emit warning log if ingestion lag > 90s or consecutive API failures > 3.
- Integrate with PagerDuty/Slack via alerting pipeline triggered by Prometheus rules.

## Testing Strategy
- **Unit tests**: mock API client and DB layer; validate dedupe logic and retry behavior (Jest + MSW or nock).
- **Integration tests**: docker-compose stack (Redis + Postgres + Timescale extension) to run ingestion flow end-to-end.
- **Load tests**: simulate 600 symbols/min using k6 or artillery; ensure queue and DB sustain throughput.
- **Failover drills**: test Redis failover and API outage scenarios (mock 500/429 responses) verifying backoff and alerting.

## Deployment & Ops
- Containerize worker; deploy as Kubernetes Deployment with HPA based on CPU and `ingestion_lag_seconds`.
- Use separate process for `QueueScheduler` (BullMQ requirement) and worker pods.
- Blue/green deploy to avoid job loss; ensure graceful shutdown by draining jobs and closing DB connections.


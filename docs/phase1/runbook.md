# Phase 1 Operations Runbook

## 1. Environment Boot
1. **Load environment variables**
   ```shell
   cp config/dev.env .env # customise credentials + API token
   ```
2. **Start infra + services**
   ```shell
   npm run dev:stack        # docker compose up timescale + redis + api + worker
   docker compose -f docker-compose.dev.yml logs -f
   ```
3. **Apply migrations (inside the API container so `timescale` hostname resolves)**
   ```shell
   docker compose -f docker-compose.dev.yml exec api npm run db:migrate
   docker compose -f docker-compose.dev.yml exec api npm run db:seed
   docker compose -f docker-compose.dev.yml exec api npm run sync:symbols
   ```
4. **Verify schema**
   ```shell
   docker compose -f docker-compose.dev.yml exec timescale psql -U postgres -d cryptobubbles -c \
     "SELECT hypertable_name FROM timescaledb_information.hypertables WHERE hypertable_name='minute_bars';"
   ```

## 2. Health & Monitoring
| Component | Endpoint / Metric | Expectation |
| --- | --- | --- |
| API Service | `GET http://localhost:8080/api/health` | `status: ok`, `redis.status: ok`, `timescale.status: ok` |
| API Liveness | `GET http://localhost:8080/api/health/live` | Always returns `{ status: "ok" }` |
| Worker Metrics | `http://localhost:9100/metrics` | Prometheus scrape target |
| Worker Liveness | `http://localhost:9100/healthz` | `{ "status": "ok" }` |
| Rate-limit Watch | `ingestion_psx_retries_total{reason="rate_limit"}` | Should stay near zero under normal load |
| Job Throughput | `ingestion_jobs_total{status="success"}` | Increments every minute when ingestion succeeds |
| API Request Volume | `ingestion_psx_requests_total{operation="klines"}` | ≤ 100 per minute (respect vendor quota) |

## 3. Routine Operations
- **Manual refresh**: `docker compose -f docker-compose.dev.yml exec worker node workers/ingestion/index.mjs` (runs once then exits).
- **Restart worker**: `docker compose -f docker-compose.dev.yml restart worker`.
- **Restart API**: `docker compose -f docker-compose.dev.yml restart api`.
- **Tail worker logs**: `docker compose -f docker-compose.dev.yml logs worker -f`.
- **Rotate API key**:
  1. Update `.env`/`config/dev.env` `PSX_API_TOKEN`.
  2. Restart worker container.
  3. Confirm `ingestion_psx_requests_total` continues to increase with `status="200"`.
- **Adjust polling cadence**: change `WORKER_POLL_CRON` in env file, restart worker.

## 4. Rate Limit / Incident Response
1. **Symptom**: `429` errors in worker logs, `ingestion_psx_retries_total{reason="rate_limit"}` climbing.
2. **Immediate actions**:
   - Pause worker (`docker compose -f docker-compose.dev.yml stop worker`).
   - Reduce `PSX_API_BATCH_SIZE` or lengthen cron interval.
   - Resume worker and monitor counters; ensure requests settle below 100/min.
3. **If vendor outage (5xx spikes)**:
   - Counters show `reason="http_503"` or similar.
   - Allow retry backoff to operate; if outage >15 min, stop worker to avoid thrash and notify stakeholders.

## 5. Data Validation
- **Latest ingestion lag**: watch `ingestion_lag_seconds` gauge (< 90 seconds target).
- **Row counts**: `SELECT count(*) FROM minute_bars WHERE ts > now() - interval '1 day';`
- **Continuous aggregates**:
  ```sql
  SELECT view_name, MIN(bucket), MAX(bucket)
  FROM minute_bars_1h
  GROUP BY view_name;
  ```

## 6. Frontend Verification
1. `npm run dev` → browse `http://localhost:5173`.
2. Confirm header reads `Live as of ...` and bubble count matches worker `snapCount`.
3. Toggle pill intervals (1 Min, 5 Min, 15 Min, Hour, Day); auto-refresh switch should trigger fetch every `VITE_AUTO_REFRESH_MS`.

## 7. Shutdown
```shell
docker compose -f docker-compose.dev.yml down -v
```
Ensure Timescale/Redis volumes removed only when intentional (drops all historical data).


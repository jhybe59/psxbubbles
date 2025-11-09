## Live PSX Operations Playbook

### Service Topology
- **TimescaleDB** (`minute_bars`, `minute_bars_5m`, etc.) — source of truth.
- **Redis** — caches analytics (`psx:market:stats:*`, `psx:analytics:version`).
- **Worker** (`npm run worker:ingest`) — polls PSX Terminal every minute.
- **API** (`npm run start:api`) — serves frontend endpoints.
- **Frontend** — consumes `/api/bubbles`, `/api/market-stats`, `/api/indices`.

### Startup Sequence
1. Export credentials:
   ```bash
   export PSX_API_BASE_URL=...
   export PSX_API_TOKEN=...
   ```
2. `docker compose -f docker-compose.dev.yml --env-file config/dev.env up -d timescale redis`
3. `npm run db:migrate && npm run db:seed`
4. `npm run worker:ingest`
5. `npm run start:api`

### Health Checks
- Worker metrics: `http://localhost:9100/metrics` (look for `ingestion_psx_requests_total`).
- API health: `GET /api/health` → verify `timescale.lagSeconds < 120`.
- Frontend banner shows `Live as of HH:MM:SS`.

### Incident Response
| Symptom | Action |
| --- | --- |
| HTTP 429 from PSX API | Check `ingestion_psx_retries_total{reason="rate_limit"}`; consider lowering `PSX_API_BATCH_SIZE`. |
| No new rows in `minute_bars` | Verify worker logs for errors; ensure credentials valid and network open. |
| Frontend stale data | Flush Redis (`redis-cli FLUSHDB`), restart worker to repopulate caches. |
| Timescale lag > 5m | Scale worker interval (`WORKER_POLL_CRON`) temporarily to catch up. |

### Maintenance
- Rotate `PSX_API_TOKEN` monthly; update `.env`, restart worker.
- Monitor storage growth: `SELECT chunk_name, total_bytes FROM timescaledb_information.chunks ORDER BY total_bytes DESC LIMIT 5;`
- Backup: `pg_dump` daily; Redis persistence optional (cache can be rebuilt).



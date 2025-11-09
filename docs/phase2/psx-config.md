## Live PSX Terminal Configuration Checklist

| Variable | Required | Description |
| --- | --- | --- |
| `PSX_API_BASE_URL` | Yes | Base URL for PSX Terminal REST API (e.g. `https://terminal.psx.com/v1`). |
| `PSX_API_TOKEN` | Yes | Bearer token issued by PSX Terminal (rotate monthly). |
| `PSX_API_BATCH_SIZE` | Optional | Symbols per request when batching minute bars (defaults to 50). |
| `PSX_API_INTERVAL` | Yes | Bar interval; use `1m` for live ingest. |
| `PSX_API_LIMIT` | Yes | Number of bars per symbol per fetch (set ≥ 60 for one hour of buffer). |
| `PSX_API_MARKET` | Optional | Market code (default `REG`). |
| `PSX_API_MAX_REQUESTS_PER_MINUTE` | Yes | Provider limit (100 rpm). Worker enforces this via token bucket. |

### Credential Placement
- Local and CI: `.env` at repo root (loaded by `workers/ingestion/config.mjs`).
- Docker: place values in `config/dev.env` or compose override.
- Production: use secret manager; map to env vars above.

### Rate Limit Strategy
- Batch symbols in groups of `PSX_API_BATCH_SIZE`.
- Enforce ≤ `PSX_API_MAX_REQUESTS_PER_MINUTE` via token bucket in worker.
- Back off on 429 with exponential + jitter (configured in `WORKER_RETRY_BACKOFF_SECONDS`).

### Verification Steps
1. Run `npm run db:seed` to ensure instruments list matches PSX Terminal symbols.
2. Start ingestion worker (`npm run worker:ingest`) with mock disabled (`PSX_API_STRATEGY=minute-bars` not set).
3. Check Prometheus metric `ingestion_psx_requests_total` for successful calls.
4. Inspect Timescale `minute_bars` table for rows with current timestamps.
5. Validate Redis keys `psx:market:stats:*` update within 2 minutes.



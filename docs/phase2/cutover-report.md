## Live PSX Cutover Verification Log

| Check | Status | Notes |
| --- | --- | --- |
| Environment variables (`PSX_API_*`) set | ☐ | Fill once secrets are configured. |
| Worker fetch succeeds against PSX Terminal | ☐ | Tail `worker` logs (`docker compose logs -f worker`). |
| Timescale minute bars updated (last 5 min) | ☐ | `SELECT max(ts) FROM minute_bars;` |
| API `/api/bubbles?interval=5m` returns data | ☐ | Expect ≥ 500 symbols. |
| API `/api/market-stats` responds within 250 ms | ☐ | Verify via k6 summary. |
| Redis cache populated (`psx:market:stats:5m`) | ☐ | Inspect via `redis-cli keys psx:*`. |
| k6 load test (scripts/load/market-stats.js) | ☐ | Target 100 rps, p95 ≤ 250 ms. |
| Prometheus counters increment (`psx_api_*`) | ☐ | Query via Prometheus UI. |
| Frontend bubble chart shows live PSX data | ☐ | Snapshot w/ timestamp + symbol count. |

### Test Procedure
1. `docker compose -f docker-compose.dev.yml --env-file config/dev.env up -d timescale redis api worker mock-psx`
2. `npm run worker:ingest`
3. Verify Timescale entries: `npm run db:psql -- -c "SELECT symbol, ts FROM minute_bars ORDER BY ts DESC LIMIT 5;"` (add script if needed).
4. Hit API endpoints via curl/Postman.
5. Run k6: `k6 run scripts/load/market-stats.js --env API_HOST=localhost:8080 --env API_KEY=<key>`.
6. Capture Prometheus metrics snapshot.
7. Update table above with outcomes, attach logs/screenshots as needed.



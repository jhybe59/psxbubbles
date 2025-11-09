<!-- 730b2bb2-00b0-4fa9-84ba-8a9126c1f83c 60504e4b-45b2-44f7-864e-83079f4c929f -->
# Phase 1 – Live PSX API Cutover

## Goals

- Replace seed/mock data with the real PSX Terminal API while honouring 100 req/min throttling.
- Keep the React bubble UI intact and resilient under live updates.

## Workstreams

- **API Contract & Credentials**: Pull PSX Terminal REST schema + auth details into `docs/phase1/api-contract.md`; store keys in `.env`, update `config/dev.env`.
- **Rate-Limited Ingestion**: Enhance `workers/ingestion/psx-api.mjs` to batch symbols, respect 100 req/min via token bucket (Redis), and cache unchanged responses.
- **Queue Scheduling**: Tune `workers/ingestion/queue.mjs` so BullMQ fans out jobs per batch, enforces backoff, and exposes Prometheus counters for throttling events.
- **Database Alignment**: Run Timescale migrations in-container, ensure schema matches PSX fields (turnover, vwap, status) and adjust aggregates if required.
- **Frontend Switch**: Flip `VITE_ENABLE_LIVE_API=true`, update `src/hooks/useOHLCV.js` for live intervals, debounce manual refresh, and QA pills with real data.
- **Ops & Runbooks**: Document start/stop and rate-limit incident response in `docs/phase1/runbook.md`; add alerts for nearing quota.

## Exit Criteria

- Live PSX data populates 50+ bubbles with <90s end-to-end latency and no rate-limit breaches in a 2h soak test.
- Timescale/Redis services stay healthy while refresh jobs run continuously.
- Operators can rotate API keys and recover from throttling using the documented runbook.

### To-dos

- [ ] Point ingestion worker to real PSX API and verify payload compatibility.
- [ ] Add retry/backoff, monitoring, and health checks across worker and API services.
- [ ] Apply Timescale migrations in-container and confirm aggregates / retention policies.
- [ ] Reconnect React app to live API, tune auto-refresh, and regression-test intervals.
- [ ] Document Phase 1 operational procedures and restart steps.
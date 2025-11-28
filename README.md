# My Cryptobubbles

Interactive market bubble viz for equities and digital assets. The project started as a CSV-driven prototype and now supports a live ingestion pipeline backed by TimescaleDB, while keeping the legacy upload tooling available for backfills.

## Table of contents

- Overview
- Quick start (demo mode)
- Live mode setup
- Environment variables
- Ingestion runbook
- Legacy workflows
- Backup & restore
- Logo migration utility
- Additional documentation

## Overview

- React + Vite single-page app that renders bubbles sized by market cap, colored by performance, with rich admin tooling (symbols, indices, backups).
- Local IndexedDB cache stores snapshot data imported from the ingestion pipeline or manual CSV uploads.
- Admin server (`npm run start-admin`) exposes authenticated endpoints for publishing index memberships and managing repo backups. The dedicated API service (`npm run start:api`) is optimized for live mode and proxies Timescale aggregates.
- Legacy CSV workflow remains available for ad-hoc data entry but is no longer the primary ingestion path.

## Quick start (demo mode)

Demo mode keeps everything local and uses generated sample data so the UI can be exercised without external dependencies.

```powershell
npm install
npm run dev
```

Open the Vite dev URL (typically http://localhost:5173). The app seeds IndexedDB with bundled demo snapshots and random coin data from `src/api/demoCoins.js`. No network calls are made, and the admin panels will operate on local storage only.

To preview backup tooling in demo mode, run the admin server in a second terminal:

```powershell
npm run start-admin
```

Then open the “Backups” floating button in the UI to interact with backup/restore endpoints.

For a self-contained sandbox of Timescale + Redis + API worker, use the provided compose stack:

```powershell
# Start Timescale, Redis, API, and ingestion worker locally (detached)
npm run dev:stack

# Launch the frontend pointing at the compose stack
npm run dev
```

Shut the stack down with:

```powershell
npm run dev:stack:down
```

Update `config/env.example` (copy to `.env`) if you need to tweak ports or credentials before starting the containers. If `psql` is available locally you can also apply all SQL migrations to the running Timescale instance with `npm run db:migrate` and seed sample instruments via `npm run db:seed`.

## Full stack quick start (live dev)

Use the bootstrap for a single command setup (Timescale, Redis, API, worker, frontend, migrations, seed):

```powershell
npm run bootstrap:dev
```

When it finishes, open the Vite URL (e.g. http://localhost:5173).

Run diagnostics anytime to verify health:

```powershell
npm run dev:check
```

Sample output shows Timescale row counts, Redis ping, API health status and worker ingestion lag. If Timescale or Redis are still starting, rerun after a few seconds.

Shut everything down:

```powershell
npm run dev:stack:down
```

If you need to override ports or credentials, edit `config/dev.env` before bootstrap; the compose stack uses that file, while host scripts (`db:migrate`, `db:seed`, `dev:check`) read `.env` (auto-created from `config/env.example` if missing).

## Live mode setup

Live mode connects the UI to the ingestion pipeline that writes validated minute bars into TimescaleDB and exposes curated JSON payloads through the admin service. The repo ships in demo mode (`liveMode` flag hardcoded to `false` in `src/App.jsx`); follow the checklist below to promote an environment to live data.

### 1. Provision dependencies

- **TimescaleDB** instance per environment (dev/stage/prod) with schemas from `docs/phase1/schema.md` applied.
- **Ingestion worker** deployment (see `docs/phase1/worker.md`) configured to poll upstream feeds, deduplicate, and upsert into TimescaleDB.
- **Bubble API / Admin service** capable of serving `/api/index_map`, `/api/symbol_metadata`, and ingestion health endpoints. During development you can reuse `npm run start-admin`; production uses the hardened service described in `docs/phase7/deployment-monitoring.md`.

### 2. Configure environment

1. Create `.env.local` (or environment-specific secret) with the variables shown in the table below.
2. Generate or rotate the admin bearer token and share it with authorized operators (store in your vault; never commit).
3. Apply database migrations (`npm run db:migrate`) and seed baseline instruments (`npm run db:seed`) so indices/favorites render correctly.
4. If you previously disabled the poller by stubbing `server/poller.cjs`, deploy the real worker container instead. The UI should not be modified; ingestion writes data into TimescaleDB and exposes aggregates via the API.

### 3. Build and run

```powershell
# Install dependencies once
npm install

# Terminal 1 – API service (live mode)
npm run start:api

# Terminal 2 – Ingestion worker
npm run worker:ingest

# (Optional) Hydrate instruments table directly from PSX Terminal
npm run sync:symbols

# Terminal 3 – Frontend
npm run build   # optional for prod build
npm run preview # or npm run dev during integration testing
```

In production, front the built assets with your CDN and run the admin/API service inside your preferred environment (Kubernetes, ECS, etc.). Ensure reverse proxy rules forward `/api/*` to the admin service while allowing `/assets/*` and SPA routes to be served as static files.

### 4. Validate live data

- Open the UI and confirm the latest snapshot timestamp (navbar) updates every minute.
- Use the Index Manager to publish a test change. A `200 OK` response indicates the token is accepted and `public/assets/migrated_index_map.json` updated.
- Cross-check TimescaleDB metrics (`ingestion_lag_seconds`, `ingestion_failures_total`) via Grafana dashboards referenced in `docs/phase7/deployment-monitoring.md`.
- If data fails to arrive, consult the runbook below for recovery steps.

### Switching from the mock feed to your provider

- Update `PSX_API_BASE_URL` and `PSX_API_TOKEN` in your `.env`/Secrets Manager.
- Stop the mock service if it is still running (`pkill -f mock-psx-api.js` or close its terminal).
- Restart the ingestion worker (`npm run worker:ingest` locally or redeploy in your cluster).
- Monitor worker logs and ingestion lag to ensure the provider feed is healthy before toggling the frontend flag for end users.

## Environment variables

| Name | Required | Default | Where | Notes |
| ---- | -------- | ------- | ----- | ----- |
| `ADMIN_PORT` | No | `4001` | Admin service (`server/admin.cjs`) | Port that the local backup/index admin server listens on. |
| `ADMIN_SECRET` | Recommended | _none_ | Admin service | Bearer token required to publish index maps. Provide to trusted operators only. |
| `INDEX_API_TOKEN` | Optional | _none_ | Admin service | Backwards-compatible name checked if `ADMIN_SECRET` is unset; safe to configure both for migrations. |
| `TIMESCALE_HOST` | Yes (live) | `localhost` | API + worker | TimescaleDB hostname. See `config/env.example` for paired `PORT`, `DB`, `USER`, `PASSWORD`, `SSL`. |
| `REDIS_URL` | Yes (live) | `redis://localhost:6379` | API + worker | Connection string used by BullMQ and rate limiting. |
| `PSX_API_BASE_URL` | Yes (live) | _none_ | Worker | Upstream provider endpoint returning minute bars. |
| `PSX_API_TOKEN` | Yes (live) | _none_ | Worker | Bearer token for the upstream provider. |
| `API_PORT` | No | `8080` | API service | Listening port for Express when running `npm run start:api`. |
| `API_KEY_PRIMARY` | Recommended | `dev-api-key` | API service + frontend | API key enforced by the API service; mirror in `VITE_LIVE_API_KEY` for the web app. |
| `VITE_ENABLE_LIVE_API` | Optional | `false` | Frontend | Toggle live mode. Set to `true` when the Timescale-backed API is reachable. |
| `VITE_LIVE_API_BASE_URL` | Optional | `/api` | Frontend | Base path/URL for bubble endpoints. Useful behind reverse proxies. |
| `VITE_LIVE_API_KEY` | Optional | _none_ | Frontend | Injects the API key in `x-api-key` header when live mode is enabled. |
| `VITE_AUTO_REFRESH_MS` | Optional | `60000` | Frontend | Auto-refresh cadence for live mode (set to `0` to disable auto refresh). |

Additional backend/worker variables (e.g. Timescale connection strings, upstream API keys, alerting toggles) live alongside the ingestion service and are tracked in `docs/phase0/env-matrix.md`. Maintain those in your infra repository or secrets manager; reference this README for the frontend/admin subset only.

## Ingestion runbook

Operational playbook for the live ingestion stack. Keep this nearby for on-call rotations.

### Normal operations

- Scheduler triggers minute workers; verify `ingestion_batches_processed_total` increments steadily.
- Timescale continuous aggregates refresh jobs should complete within their SLA (see `docs/phase7/deployment-monitoring.md`).
- UI health check: `/api/healthz` returns `200` with current `ingestion_lag_seconds` under 90 seconds.

### Manual triggers & backfills

1. Pause autoscaling to keep a consistent worker count if running a large backfill.
2. Use the ingestion admin CLI (see `docs/phase1/admin-cli.md`) `reingest` commands to enqueue ranges. Monitor queue depth to avoid overruns.
3. After completion, validate Timescale row counts for affected symbols and rerun the UI smoke test.

### Failure recovery

- **Lag breach (>90s)**: Check upstream API status, inspect worker logs, and confirm Timescale is writable. Restart the worker deployment if stuck; if lag persists, escalate to the data provider.
- **Timescale outage**: Fail over to replica per `docs/phase0/architecture/overview.md`. Workers should backoff automatically; resume once primary is healthy.
- **Admin publish failures (403)**: Rotate `ADMIN_SECRET`, redeploy admin service, and update on-call vault entry. Flush `localStorage.indexMap` in browsers if stale state persists.
- **Corrupt snapshots**: Use the backup tooling to restore the latest healthy `public/assets` payload, or as a last resort fall back to the legacy CSV workflow for targeted symbols.

### Escalation

- Notify the data engineering channel after 10 minutes of unresolved lag or on repeated ingestion failures. Include Grafana dashboard links and worker logs.
- Page the database team if Timescale replication lag or storage saturation alarms fire (see `docs/phase7/deployment-monitoring.md`).

## Legacy workflows

### Legacy CSV workflow (deprecated)

The CSV Manager (`CSV ▾` floating button) provides manual snapshot uploads into IndexedDB. This path is maintained solely for:

- Emergency backfills when ingestion is down.
- Side-by-side validation against provider exports.
- Air-gapped demos with curated datasets.

Usage reminders:

- Enable “Replace DB” to wipe prior snapshots before a bulk import.
- Filenames should include `YYYY-MM-DD` to auto-target the calendar date.
- After resolving incidents, delete manual uploads and allow live ingestion to repopulate data.

Add a “Legacy CSV workflow” callout in ops docs or runbooks whenever referenced so new engineers treat it as deprecated tooling.

### Repository snapshot imports

If `ENABLE_REPO_SNAPSHOTS` in `src/config.js` is set to `true`, the app will auto-import `public/psx_snapshots.json` once into IndexedDB. Leave it `false` in production; live environments should rely on Timescale + ingestion.

## Backup & restore

The repo ships with local backup helpers that archive the working tree (including `.git`) to a sibling directory named `<project>_backups`.

```powershell
# Create backup
npm run backup

# Restore interactively or by filename
npm run restore
npm run restore <backup.zip>
```

Notes:

- `node_modules` is excluded from archives to keep backups small.
- Restore prompts before overwriting and extracts directly into the repo root.
- Run `npm run start-admin` to access the same functionality from the UI backup panel.

## Logo migration utility

If symbol logos were captured as data URIs inside localStorage, export `symbol-metadata.json` from the Symbols Panel and run:

```powershell
npm run migrate-logos -- symbol-metadata.json
```

The script writes physical assets to `public/assets/logos/` and creates `public/assets/migrated_symbol_metadata.json`. Re-import or commit the migrated file so logos load without relying on localStorage.

## Additional documentation

- Deployment and monitoring deep dive: `docs/phase7/deployment-monitoring.md`
- Ingestion pipeline design: `docs/phase1/worker.md`
- Environment sizing matrix: `docs/phase0/env-matrix.md`
- Testing strategy and integration guidance: `docs/phase6/testing-strategy.md`
- k6 load test harness: `tests/perf/bubbles-load.js`

## Phase 6 – Comprehensive Testing Strategy

### Objectives
- Validate client-side normalization and visualization logic remains stable as data volume grows.
- Ensure API + TimescaleDB integration delivers consistent, timely payloads across query permutations.
- Prove the system withstands loads representing 500+ actively traded symbols across multiple intervals.
- Provide actionable manual QA steps for high-visibility UI flows (interval switching, auto-refresh, index/favorites navigation).

---

### Unit Testing (Jest)
- **Scope**
  - `src/hooks/useSymbolMetadata.js`: `normalizeSymbolKey`, duplicate-key merges, storage event fan-out.
  - `src/hooks/useOHLCV.js`: interval calculations (`INTERVAL_LOOKUP`), duplicate snapshot pruning, daily change derivation.
  - `src/lib/chartUtils.js`: candle/line/volume series builders (sorting, bucket aggregation, numeric coercion).
  - `src/lib/storage.js`: data coercion in `saveSnapshots`, latest snapshot selection, range queries.
- **Framework & Tooling**
  - `jest` with `babel-jest` for JSX/ESM, `@testing-library/react` + `@testing-library/react-hooks` (or React Testing Library’s `renderHook`) for hook execution.
  - `jest-fetch-mock` or `msw` (node mode) to simulate `/psx_snapshots.json` and metadata fetches.
  - `fake-indexeddb/auto` to emulate IndexedDB APIs exercised by `storage.js`.
  - `jest.useFakeTimers()` to exercise refresh scheduling in `useCoins` and `useOHLCV`.
- **Representative Test Cases**
  - Normalization: whitespace symbols collapse, mixed-case keys dedupe, invalid symbols skipped, merge precedence verified.
  - Storage save coercion: `saveSnapshots` converts `c/v/val` aliases, assigns defaults, preserves raw payload; `getLatestAll` honours most recent timestamp.
  - Interval math: `refreshForInterval('Week')` picks correct lookback, handles missing historical prices (returns `null` pct), surfaces errors.
  - Chart utilities: bucketed candles respect `periodMs`, handle non-monotonic timestamps, propagate volume sums.
  - Hook behavior: `useOHLCV` re-import guard (skips fetch on existing data unless force), `useSymbolMetadata` updates on local `dispatchEvent` and `storage` events.
- **Automation Notes**
  - Run via `npm test -- --watch` locally; enforce coverage thresholds (≥80% statements/branches for utilities and hooks).
  - Snapshot tests discouraged; prefer explicit assertions to ease data evolution.

---

### Integration Testing (Supertest + Timescale Test DB)
- **Environment**
  - Spin up TimescaleDB via `docker compose up timescale-test` seeded with representative `minute_bars` + aggregates (see `docs/phase1/schema.md`).
  - Use `.env.test` for isolated credentials; point API server to test DB and a Redis mock (or `redis-mock`) if caching enabled.
- **Framework & Tooling**
  - `jest` + `supertest` against the Express API (see `docs/phase2/api-endpoints.md`).
  - Database utils: `pg` pool with migration runner (e.g., `node-pg-migrate`) to reset schema per suite; wrap tests in transactions or truncate tables between cases.
- **Core Test Suites**
  - `GET /api/bubbles`
    - Happy path for intervals `1m`, `5m`, `Day`; ensure correct source view per interval.
    - Limit/offset enforcement, `indices` filter trimming to seeded membership list, `favorites` priority ordering.
    - Timescale outage simulation (drop connection) → expect `503` with retry headers.
    - Cache validation: consecutive call within TTL returns identical `ETag`; stale cache invalidated when new `bucket` inserted.
  - `GET /api/snapshots`
    - Aggregated totals align with seeded sums; handles `interval` + `index` combos.
  - `GET /api/indices`
    - Metadata payload, optional `includeMembers=true` expansion, 404 on unknown index.
  - `GET /api/symbols/:symbol`
    - Latest vs historical bucket join, ensures nulls for missing optional columns.
  - `GET /api/health`
    - Inject simulated lag to verify warning fields.
- **Data Management**
  - Seed fixtures representing ≥10 symbols with differing pct change/volume to validate sorting logic.
  - Use SQL scripts to insert snapshots with overlapping timestamps for regression coverage.
  - Wrap suites with `beforeAll` migrations, `beforeEach` deterministic seed, `afterAll` pool cleanup.
- **Execution**
  - CI pipeline stage `npm run test:integration` gating merges; optional nightly job hitting full matrix (interval × limit × index combinations).

---

### Load Testing (k6)
- **Goals**
  - Validate `GET /api/bubbles` handles 500–600 symbol payloads with <1.5s p95 latency under bursty traffic.
  - Ensure multi-interval querying (`1m`, `5m`, `15m`, `Day`) and favorites/indices filters scale linearly.
- **Scenario Design**
  - Script `k6` stages: ramp 0→50 virtual users (VUs) in 2m, hold 50 VUs 3m, spike to 120 VUs for 1m, cool down.
  - Each VU cycles intervals and query params (favorites list of 50 symbols, index filter combos) pulling from seeded symbol fixture.
  - Inject concurrent metadata fetch (`/api/indices`, `/api/snapshots`) to mimic dashboard refresh.
- **Metrics & Thresholds**
  - `http_req_duration{endpoint:/api/bubbles}`: p95 ≤ 1.5s, p99 ≤ 2.5s.
  - Error rate (`checks` failures) < 1% across run; `http_req_failed` threshold < 0.5%.
  - Custom Trend capturing payload size and DB query time via server-side instrumentation/log parsing.
- **Execution Modes**
  - Local dry-run: `docker run grafana/k6 run bubbles-load.js` with scaled-down VUs.
  - CI/nightly: GitHub Actions self-hosted runner or cloud VM (8 vCPU, 16 GB RAM) hitting staging API.
  - Pre-release soak: Deploy k6 operator on k8s, run 15–30m soak test validating autoscaling (HPA) and Timescale resource utilization.
- **Data Prep**
  - Seed Timescale with ≥600 symbols; ensure continuous aggregates refreshed to avoid cold-start penalties.
  - Warm Redis/cache before load to replicate real usage.

---

### Manual QA Checklist
- **Interval Switching**
  - From `Day` to `Week`/`Month`: verify bubble sizes/colors shift, legend updates, chart re-renders without stale tooltips.
  - Confirm toast/error surfaced when historical data missing; interval dropdown persists selection across refresh.
- **Auto Refresh**
  - Start auto-refresh (default 60s) and observe DOM updates without full page reload; ensure loading shimmer visible, errors recover on next tick.
  - Validate `useCoins` timer cleared on unmount/navigation.
- **Index Selection**
  - Toggle between KSE-100, All Shares, sector indices. Ensure counts and aggregate stats update; favorites still highlighted when index filter active.
  - Drill into symbol detail modal/drawer to confirm index metadata surfaces correctly.
- **Favorites / Pages Menu**
  - Add/remove favorites; confirm persistence in localStorage and highlight in bubble view.
  - Navigate between pages (if paginated view exists) verifying state sync with favorites and intervals; ensure browser back navigation restores selection.
- **Regression Spot Checks**
  - Validate metadata import fallback by clearing storage; confirm assets load from `/assets/migrated_symbol_metadata.json`.
  - Cross-browser smoke (Chrome, Firefox, Edge) for hover/click interactions and responsive layout.

---

### Toolchain Summary
- Unit: `jest`, `@testing-library/react`, `@testing-library/react-hooks`, `jest-fetch-mock`, `fake-indexeddb`.
- Integration: `jest`, `supertest`, `pg`, `node-pg-migrate` (or equivalent), Dockerized TimescaleDB, optional `testcontainers` wrapper.
- Load: `k6` (CLI/Docker/k8s operator); run `k6 run tests/perf/bubbles-load.js -e BUBBLES_BASE_URL=https://api.example.com/api -e BUBBLES_API_KEY=...` for the bundled scenario; correlate with Prometheus/Grafana dashboards.
- QA Support: Browser devtools performance panel, `lighthouse` sanity check, feature toggle to force demo snapshots for deterministic testing.

---

### Reporting & Automation
- Wire test runs into CI (GitHub Actions):
  - `npm run test:unit` on pull requests.
  - `npm run test:integration` behind Timescale service container using `services:` block.
  - Nightly load test trigger posting Grafana dashboard link & summary to Slack.
- Store flaky test quarantine list; require lead approval before skipping tests.
- Maintain test data fixtures under `tests/fixtures/` with versioned CSV/JSON reflecting Timescale schema.

---

### Next Steps
- Stand up shared `docker-compose.test.yml` to coordinate API, Timescale, Redis for integration suite.
- Author initial unit tests targeting `normalizeSymbolKey` and `buildCandlesFromSnapshots` to establish patterns.
- Tune k6 thresholds in `tests/perf/bubbles-load.js` once production baselines are known.
- Schedule manual QA runbook walkthrough ahead of Phase 6 launch.


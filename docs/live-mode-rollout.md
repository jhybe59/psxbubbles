# Live Mode Rollout & Risk Mitigation

## Overview & Goals
- Deliver live Timescale-backed data in place of CSV snapshots without interrupting client experience.
- Maintain continuity for existing charts by backfilling CSV history into Timescale before any user-visible toggle.
- Limit blast radius via controlled feature flag rollout, staged verification, and explicit rollback paths.

## Feature Flag Strategy
- **Flag location:** Frontend feature flag (`ui.liveModeEnabled`) controls whether requests hit live Timescale-backed APIs or legacy CSV-backed endpoints.
- **Default state:** `false` → legacy path. Live mode remains dark until all decision gates are cleared.
- **Configuration:** Manage via remote config (e.g., LaunchDarkly/Toggles service) with per-environment targeting and gradual percentage rollouts.
- **Instrumentation:** Emit flag evaluation metrics (cohort, latency, error rate) to confirm rollout health.

### Rollout Sequence
1. **Internal testers only** (staging + production behind allow list).
2. **1% external traffic** with automated alerting thresholds.
3. **25% cohort** once stability confirmed for ≥24h.
4. **100% rollout** after business sign-off.

**Decision gates**
- Gate A: Error rate ≤ 0.5% and P95 latency within 20% of legacy path for 12h before moving to 1% cohort.
- Gate B: No critical alerts and data parity spot-checks within ±0.5% price variance versus CSV snapshots for 24h before moving to 25%.
- Gate C: Confirm ingestion lag < 60s and UX smoke tests pass before enabling for all users.

## Staged Deployment Workflow

### Stage 0 – Development Sandbox
- Connect to mock/recorded API responses to vet schema changes and measure client compatibility.
- Use `npm run db:migrate && npm run db:seed` against the local compose stack to keep schemas up to date with application expectations.
- Populate the instruments table from the upstream universe via `npm run sync:symbols` so ingestion covers all REG tickers.
- Run unit/integration suites plus contract tests against Timescale schema.
- **Decision gate:** All automated tests green; linting and type checks clean.

### Stage 1 – Staging with Real API Subset
- Mirror production config but restrict ingestion to curated symbol subset (e.g., top 20 traded tickers).
- Schedule ingestion workers to hit live provider endpoints at reduced cadence (e.g., every 5 min) to limit cost while validating pipeline.
- Execute manual QA: chart rendering, caching behavior, and failover paths.
- **Decision gate:** Staging dashboards show ingestion lag < 120s, no schema drift vs. prod expectations, QA sign-off recorded.

### Stage 2 – Production Shadow Mode
- Enable live ingestion in production Timescale while feature flag remains off (shadow write/read audits only).
- Compare live Timescale data against legacy CSV responses for parity via automated diff job.
- After two full trading sessions without parity drift, begin feature flag rollout sequence.
- **Decision gate:** Shadow diff job < 0.5% discrepancy window; on-call sign-off before user exposure.

## Data Backfill Strategy
- **Extract:** Use existing CSV archives (`OHLCV/`) and normalize into staging tables matching `minute_bars` schema.
- **Transform:** Convert timestamps to UTC, map symbols to `instruments`, fill missing fields with defaults, and dedupe by `(symbol, ts)`.
- **Load:** Bulk ingest via `COPY` into Timescale staging table, then upsert into `minute_bars` using `INSERT ... ON CONFLICT`.
- **Validation:**
  - Row counts vs. CSV lines (tolerance ±0.1%).
  - Spot-check OHLCV values for sample symbols/dates.
  - Verify continuous aggregate refresh policies backfill historical buckets.
- **Catch-up:** Schedule incremental job to import any CSV files generated after initial bulk load but before cutover.
- **Decision gate:** Backfill parity report clean; aggregates populated; retention/compression policies applied without errors before moving to shadow mode.

## Data Retention & Bloat Prevention
- Apply Timescale retention to drop `minute_bars` entries beyond 90 days (per storage design).
- Enable Timescale compression for partitions older than 7 days, ordering by `(symbol, ts)`.
- Maintain continuous aggregates (`agg_5m`, `agg_15m`, `agg_1h`, `agg_1d`) and serve older ranges (>90 days) via aggregates only.
- Export purged raw data to cold storage (S3) before retention policy executes when compliance requires.
- Monitor chunk stats weekly to adjust retention/compression thresholds if ingest volume changes materially.

## Fallback & Rollback Plan
- **Trigger conditions:** Error rate > 2%, ingestion lag > 5 minutes, or material data divergence detected.
- **Actions:**
  1. Toggle feature flag to `false` to send all users back to legacy CSV path.
  2. Pause Timescale ingestion workers to stop compounding faulty data.
  3. Communicate rollback to stakeholders and create incident ticket.
  4. Investigate root cause (API outage, schema drift, ingestion bug) before reattempting rollout.
- **Data hygiene:** Retain shadow-mode data for forensic analysis; mark suspect ranges with quality flags instead of deleting immediately.
- **Recovery timeline:** Minimum 1 full trading session of stable shadow data + regression tests before re-enabling live mode.

## Monitoring & Alerting
- Dashboards: ingestion lag, API error rates, feature flag cohort metrics, cache hit ratio.
- Alerts: ingestion lag > 90s, API 5xx > 1%, diff job parity failure, Timescale hypertable bloat warnings.
- On-call drill: run tabletop exercise covering live-mode incident + rollback.

## Deployment Checklists & Decision Gates

| Phase | Checklist | Decision Gate |
| --- | --- | --- |
| Pre-backfill | Confirm Timescale schema migrated; verify retention & compression policies scripted; dry-run CSV parser on sample file. | Sign data engineering lead-off; zero validation errors in dry run. |
| Backfill window | Run bulk import job; monitor row counts; refresh aggregates; execute parity diff against CSV snapshots. | Backfill parity report within tolerance; aggregates refreshed without errors. |
| Shadow mode | Enable live ingestion; run automated diff job hourly; execute UI smoke tests against hidden live endpoints. | Shadow metrics stable for 2 sessions; incident-free. |
| Gradual rollout | Flip feature flag for internal users; expand cohorts per rollout sequence while monitoring dashboards. | Each cohort meets error/latency thresholds before expansion. |
| Post-cutover | Decommission CSV cron jobs; confirm retention jobs executing; archive legacy data to cold storage. | Post-go-live review complete; monitoring steady for 48h. |



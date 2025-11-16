# External API Contract Expectations

## Scope & Delivery Model
- Preferred delivery path: REST polling on a 60-second schedule for stable rollout.
- Evaluate optional WebSocket/streaming support for future low-latency upgrades (requires heartbeat and reconnect policies).
- Require endpoints to support both real-time polling and historical backfill.

## Authentication & Access Control
- Primary auth mechanism: HTTPS bearer token supplied via `Authorization: Bearer <token>` header.
- Expect monthly key rotation window; vendor should provide overlapping validity or dual-key period.
- Sandbox/test credentials required for development environments.
- Clarify IP allowlisting, if enforced, and self-service credential management options.

## Rate Limits & Throughput
- Target allowance: ≥ 60 requests per minute to accommodate per-minute polling with headroom for retries.
- Prefer bulk-fetch endpoint that accepts symbol lists to minimize overall call volume.
- Document burst policy (e.g., short spikes allowed vs strict per-second throttle) and expected response degradation.
- Communicate quota reset schedule and monitoring hooks (headers or status endpoint).

## Endpoints & Filtering
- Minute bars endpoint accepting query parameters:
  - `symbols` (comma-separated list)
  - `from` / `to` timestamps for backfill (ideally ISO8601)
  - Pagination controls when response size exceeds limits
- Historical endpoint for seeding data from a specified start date.
- Reference data endpoint(s) for instrument metadata, index membership, and corporate actions if available.

## Response Schema Requirements
- JSON payload with explicit field names and numeric types (precision to 4 decimal places where applicable).
- Mandatory fields per bar: `symbol`, `timestamp`, `open`, `high`, `low`, `close`, `volume`, `pct_change`, `daily_pct`.
- Optional but desired fields: `turnover` (value), `bid`, `ask`, `vwap`, `status`, corporate action flags.
- Timestamps ideally in ISO8601 UTC; if epoch (ms preferred), document unit clearly.
- Null value conventions must be stable (e.g., use `null`, avoid empty strings). Specify sentinel values for suspended symbols.
- Provide sample payloads covering: normal trade, halted symbol, suspended day, corporate action flag.

## Error Handling & Resilience
- HTTP semantics: 2xx success, 4xx client issues (e.g., invalid symbol, auth), 5xx server errors.
- Rate limiting responses should return 429 with retry-after guidance.
- Maintenance/outage announcements should be exposed via status endpoint or webhook.
- Contract requires clear guidance on retries: which error codes are safe to retry and recommended backoff.

## Contract Governance
- Changes must be versioned (URL or header) with deprecation windows ≥ 30 days.
- Publish changelog and advanced notice for new fields/behavior changes.
- Define escalation path and SLA: uptime target, response time commitments, support hours.

## Open Questions for Provider
1. Is there a guaranteed ordering or sequence ID for minute bars to detect out-of-order delivery?
2. How far back does historical coverage extend, and is there a limit on backfill request size?
3. Are corporate actions exposed in real time, and what latency should we expect for those flags?
4. Does the API support differential queries (e.g., only changed symbols) to reduce payload size?
5. Are there regional endpoints or CDN requirements for optimal latency from Pakistan?


















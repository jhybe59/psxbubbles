# Security, Reliability & Observability Plan

## Authentication & Authorization
- Implement API key auth using HMAC-signed keys stored in Secrets Manager.
- Middleware sequence:
  1. `requestId` – attach correlation ID
  2. `rateLimiter` – per-key quotas (Redis leaky-bucket)
  3. `apiKeyAuth` – validate `x-api-key` header, enforce scopes (`read:bubbles`, `read:snapshots`)
  4. `inputValidator` – sanitize query params via `zod`
- Support key rotation: dual-key header `x-api-key-secondary`; allow overlapping validity window.
- Provide separate keys per environment; dev/stage keys limited to non-prod endpoints.

## Rate Limiting & Throttling
- Use `rate-limiter-flexible` with Redis backend; defaults: 100 req/min, burst 20 requests.
- Additional circuit breaker: if backend detects Timescale overload, reduce allowed rate (dynamic config via Redis).
- Expose rate limit info via headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`).

## Error Handling
- Central error middleware returning structured JSON with error codes.
- Mask internal errors; log stack traces server-side only.
- Automatic retries for DB transient errors where safe (e.g., serialization failures) with small backoff.

## Logging
- Structured logging via `pino` (JSON) with levels.
- Include fields: `requestId`, `apiKeyId`, `symbolCount`, `interval`, `durationMs`, `statusCode`.
- Ship logs to ELK/Loki with 30-day retention; trigger alerts on error rate spikes.

## Metrics & Tracing
- Prometheus metrics:
  - `http_requests_total{route, status}`
  - `http_request_duration_seconds` histogram
  - `ingestion_lag_seconds` (pulled from Timescale)
  - `timescaledb_connection_usage`
- Expose metrics at `/internal/metrics` protected by IP allowlist or auth.
- Optional OpenTelemetry tracing: instrument Express handlers, DB queries, and Redis interactions.

## Monitoring & Alerting
- Grafana dashboards covering API latency, request volume, ingestion lag, queue depth, error rates.
- Alert thresholds:
  - P95 latency > 2s for 5 minutes
  - Error rate > 2% over 5 minutes
  - Ingestion lag > 120 seconds
  - Redis queue length > 3x baseline
- On-call notification via PagerDuty; staging alerts route to Slack only.

## Operational Runbooks
- Playbooks for: API key rotation, rate limit tuning, Timescale failover, Redis outage, API overload.
- Each runbook includes command snippets (CLI), dashboards, escalation paths.

## Security Hygiene
- TLS termination at load balancer with automatic certificate renewal (ACM/Let’s Encrypt).
- Disabled HTTP methods other than GET/HEAD for public endpoints.
- Implement basic WAF rules against injection, path traversal, and common bots.
- Conduct quarterly vulnerability scan and dependency audit (`npm audit`, Snyk).
- Ensure principle of least privilege for DB users (`frontend_api` role with read-only grants on aggregates, limited scope on raw table).









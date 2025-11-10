# Admin & Operations Tooling (CLI)

## Objectives
- Provide lightweight operational controls during Phase 1 without building a full UI.
- Surface ingestion status, queue health, and allow reprocessing commands for ops engineers.

## Tooling Choice
- Node.js CLI using `commander` for command parsing.
- Shared libraries with ingestion worker (config loader, logging, DB client).
- Distribution: part of backend repo; executable via `node scripts/ingest-admin.js` or npm script.

## Proposed Commands

| Command | Description |
| --- | --- |
| `status` | Display latest ingestion metrics: last processed timestamp per symbol, max lag, queue depth, job failures in past hour. |
| `reingest --symbol <SYM> --from <ISO> --to <ISO>` | Force enqueue backfill jobs for a symbol over a time window. |
| `reingest --from <ISO> --to <ISO>` | Bulk reprocess for all symbols (with rate-limit safeguards). |
| `queue ls` | Show BullMQ queue stats (waiting, active, delayed, failed). |
| `queue retry --job-id <ID>` | Retry a failed job. |
| `gap-report [--hours 24]` | Generate report of detected minute gaps per symbol over period. |
| `token rotate --token <value>` | Update API token in secrets manager or .env (dev only). |

## Implementation Notes
- Access TimescaleDB via read-only queries for reporting commands; use stored procedures for reingest to ensure uniform logic.
- For reprocess commands, publish jobs to BullMQ `backfillQueue` with dedupe key to prevent duplicates.
- Integrate with Prometheus pushgateway (optional) to emit manual intervention markers.
- Output structured JSON option (`--json`) for scripting.

## Security & Access Control
- CLI requires appropriate IAM role/credentials to reach Redis and Timescale.
- Production usage gated behind VPN / bastion host; wrap commands in runbooks.
- Audit logging: log every CLI action with user identity to centralized log store.

## Testing & Validation
- Unit tests for command parsing and error handling (Jest).
- Integration tests in CI using docker-compose stack; simulate queue operations.
- Dry-run mode (`--dry-run`) to preview job counts before enqueuing.











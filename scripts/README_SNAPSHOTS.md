Snapshot generation and safety
================================

This project used to ship a large prebuilt `public/psx_snapshots.json` that the client automatically imported into IndexedDB. That behavior caused each client to end up with a very large local DB and many duplicate snapshot records.

What we changed
- `public/psx_snapshots.json` was replaced with `[]` in the repository so deployments won't auto-import snapshots anymore.
- The `build-snapshots` npm script was removed from `package.json` to reduce the risk of regenerating the file by accident.

How to (re)generate snapshots (manual, controlled)
1. Prepare one or more CSV files containing per-symbol OHLCV rows. Use the web UI (CsvPanel) to import them. The app's CSV import path writes directly into the IndexedDB store used at runtime.
2. If you absolutely need a repository-level snapshot export (not recommended for production), use the generator script manually on an admin machine and keep a backup:

   # from project root (PowerShell)
   node ./scripts/generate_snapshots_json.cjs

   Note: this script reads the `OHLCV/` directory and writes `public/psx_snapshots.json`. Do NOT run it from a CI or on a deployment host unless you want every client to potentially import a very large file.

Recommended workflow
- Keep `public/psx_snapshots.json` empty in the repo.
- Use CSV uploads via the app's UI for controlled ingestion.
- If you need deterministic public snapshots for a specific release, generate them once on an admin machine, push under a tagged path (for example `public/snapshots/release-2025-11-03.json`) and reference that file from an admin-only endpoint — do not leave a huge file at `public/psx_snapshots.json`.

If you'd like, I can:
- add an authenticated admin endpoint to clear `server/cache.json` and reset snapshot artifacts
- add a small script that archives `OHLCV/` into `OHLCV_archive_TIMESTAMP` to avoid re-running the generator accidentally

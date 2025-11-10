<!-- 4f728a44-6bb7-43a4-9f47-0b09042839b3 fe13dfd6-0f8b-4a92-9ef7-4053befdd80f -->
# Focus KMIALLSHR Tick Ingestion

1. Filter Symbol Universe

- Teach `workers/ingestion/symbols.mjs` to respect new config `SYMBOL_INDEX_CODE`.
- Load memberships from `public/assets/migrated_index_map.json` and limit to `KMIALLSHR`.

2. Adjust Tick Fetch Cadence

- Update env defaults (`config/dev.env`, `.env`) for KMIALLSHR run: `WORKER_SYMBOLS_PER_MINUTE=100`, `PSX_API_MAX_REQUESTS_PER_MINUTE` tuned to avoid 503s.
- Ensure chunk rotation still cycles 100/100/80 once while market is closed.

3. Fix Percentage Calculations

- In `workers/ingestion/psx-api.mjs`, persist tick change percent without double scaling.
- In `/api/bubbles`, prefer stored `daily_pct` when present so interval % uses real tick change instead of historical LAG.

4. Validate Narrow Run

- Rebuild/restart worker; confirm logs show 3 cohorts for `KMIALLSHR` and no 4xx/5xx bursts.
- Hit `/api/bubbles?interval=1m&limit=20` and verify percent outputs are sane (e.g., FFC ≈ 2.28%).

### To-dos

- [ ] Restrict ingestion symbol list to KMIALLSHR index
- [ ] Update env defaults for KMIALLSHR cadence (100/100/80 rotation)
- [ ] Store and serve accurate tick percentage values in ingestion/API
- [ ] Rebuild worker, ingest one cycle, and spot-check API data
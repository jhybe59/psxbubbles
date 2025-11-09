# PSX Terminal REST Contract (Phase 1)

## Provider Overview
- **Base URL:** `https://psxterminal.com/api`
- **Auth:** HTTPS bearer token via `Authorization: Bearer <token>`
- **Quota:** 100 requests per rolling minute (soft limit, `429` on breach)
- **Timeout Guidance:** Abort client requests after 10 s; retry with backoff on `429`, `500`, `503`

## Primary Endpoints
| Purpose | Endpoint | Notes |
| --- | --- | --- |
| Symbol universe | `GET /symbols` | Returns active PSX tickers and metadata. Cache locally; refresh daily. |
| Latest minute bar | `GET /klines/{symbol}/1m?limit=1` | Provides most recent 1 m candle for a symbol. Payload may be array-of-arrays or array-of-objects. |
| Backfill range | `GET /klines/{symbol}/{interval}?from=<iso>&to=<iso>` | Use for historical seeding. Interval supports `1m`, `5m`, `15m`, `1h`, `1d`. |
| Market snapshot | `GET /ticks/{market}` | Optional bulk snapshot (`market` default `REG`). Use when reducing calls; includes last trade + change metrics. |
| Health | `GET /status/ping` | Returns `{ "status": "ok" }` when platform healthy. Poll for monitoring. |

## Response Shapes
### `klines` (array form)
```json
[
  [
    1730808600000,
    "72.40",
    "72.90",
    "71.80",
    "72.10",
    "125000",
    "9025000",
    "-0.55",
    "-0.76"
  ]
]
```
- `[0]` timestamp (epoch ms, UTC)
- `[1-4]` OHLC (strings with 2 decimal precision)
- `[5]` volume (shares)
- `[6]` turnover/value (PKR)
- `[7]` interval percent change
- `[8]` day percent change (vs session open)

### `klines` (object form)
```json
[
  {
    "time": "2024-11-05T10:15:00Z",
    "open": 72.4,
    "high": 72.9,
    "low": 71.8,
    "close": 72.1,
    "volume": 125000,
    "turnover": 9025000,
    "changePercent": -0.55,
    "dailyChangePercent": -0.76,
    "status": "OPEN"
  }
]
```

### `ticks`
```json
{
  "market": "REG",
  "asOf": "2024-11-05T10:15:00Z",
  "symbols": [
    {
      "symbol": "HUBC",
      "last": 72.1,
      "changePercent": -0.55,
      "dayChangePercent": -0.76,
      "turnover": 9025000,
      "volume": 125000,
      "status": "OPEN"
    }
  ]
}
```

## Integration Notes
- **Rate Limit Strategy:** Default polling uses sequential `klines` calls capped at `PSX_API_BATCH_SIZE` (≤ 100). Later work adds Redis-backed token bucket to smooth spikes.
- **Consistency:** `klines` timestamps are UTC. Convert to epoch ms before inserting into Timescale.
- **Field Mapping:** Persist transfer fields into `minute_bars`:
  - `turnover` → `value`
  - `changePercent`/`dailyChangePercent` → `intervalPct`/`daily_pct`
  - Preserve vendor payload in `metadata` for audit/debug.
- **Error Semantics:** `401/403` for auth issues, `404` for unknown symbol, `429` for quota, `5xx` transient.
- **Backfill:** Use nightly job to request historical windows per symbol while respecting quota (e.g., 20 requests/minute overnight).

## Open Actions
1. Confirm exact quota reset semantics (fixed vs sliding window).
2. Request sandbox API key distinct from production key.
3. Validate if `ticks` payload can replace per-symbol `klines` for latest snapshot to reduce calls once pipeline is stable.


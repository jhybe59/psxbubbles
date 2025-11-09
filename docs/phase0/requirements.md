# Functional Requirements & Data Coverage

## Market Scope
- Focus on PSX regular equity listings (`REG` market). Futures, odd-lot, and other venues remain out of scope until explicitly required.
- Maintain canonical lists for key indices (KSE-100, KSE-30, ALLSHR, KMI) to drive UI grouping and sector views.

## Trading Calendar
- Market hours: 09:15–15:30 Pakistan Standard Time (UTC+05:00), Monday through Friday.
- No lunch break at present; accommodate future policy changes through a managed schedule table.
- Track official PSX holidays and unscheduled closures; source from PSX calendar and sync regularly.

## Instrument Identity & Metadata
- Treat the uppercase PSX ticker symbol as the primary key used across UI and storage.
- If the API exposes UUIDs or alternate identifiers, preserve them in a mapping table while keeping the symbol authoritative.
- Persist corporate action indicators (bonus, split, suspension, ex-dividend) within an instrument metadata table to enable future adjustments.

## Minute Bar Payload (Required Fields)
- `symbol`
- `timestamp` (stored as epoch milliseconds in UTC; UI converts to PKT)
- `open`, `high`, `low`, `close`
- `volume`
- `turnover` / traded value when provided
- Optional now, plan for later use: `bid`, `ask`
- `pct_change` (interval change vs prior bar)
- `daily_pct` (change vs day open)
- Optional enhancements: `vwap`, `status` (halt/suspend), corporate action flags

## Derived Metrics & Downstream Needs
- Recent interval percent change for bubble “pills”.
- Day high/low for detail popovers.
- Weekly and 52-week statistics earmarked for roadmap features.
- Advancers vs decliners counts, including favorites list.
- Sector-level aggregation powered by index membership metadata.

## Latency, Completeness & UX Expectations
- Minute-level data freshness target: ≤ 90 seconds end-to-end from market print to availability in the app.
- No synthetic bars inserted for missing minutes; instead raise monitoring alerts and let the UI degrade gracefully with fallback logic.
- Manual refresh control in UI remains available for users to request latest data on demand.

## Data Quality Monitoring (Initial Signals)
- Detect ingestion lag beyond 90-second SLA.
- Flag gaps in minute series per symbol.
- Surface zero-volume anomalies or repeated identical bars for investigation.


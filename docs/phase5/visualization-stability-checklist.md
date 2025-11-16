# Phase 5 – Visualization Stability Checklist

## 1. BubbleChart Data Contract
- **Shape**: `BubbleChart` receives an ordered `Array` of coin objects. Order controls which items survive the `slice(0, 140)` cap, so preserve ranking semantics in the new pipeline.
- **Required identifiers**: ensure every item has stable `id`, `symbol`, and `name`. These power React keys, tooltips, label text, and search/index lookups (`symbol` is lowercased and matched against metadata, indices, and favorites).
- **Price change metrics**:
  - `price_change_percentage_24h` (number) is the primary driver for ring color, single-view ranking, and default sizing. When interval aggregations are supplied, they are looked up by `symbol`, `id`, or uppercased `name` in the `Map` passed via the `aggregations` prop.
  - For demo overrides, the component respects `__overrideDemo` on each datum. Avoid emitting this flag unless intentionally simulating moves.
- **Sizing metrics** (selected via pills):
  - `volume`, `total_volume`, `'24h_volume'`, or `v` (strings with commas or numbers) feed the *Volume* size option. Keep raw numbers or numeric strings; the chart strips commas before casting.
  - `market_cap`, `data.market_cap`, or `marketCap` back the *Market Cap* size option.
  - Nested `data` support: if the pipeline supplies a `data` object, mirror the above fields inside it to retain compatibility with PSX-specific enrichments (price, volume, market cap).
- **Logos & labels**: supply `image` (URL) whenever possible; UI falls back to text symbols when absent. Metadata merging in `App.jsx` will overlay `displayName`/`shortName` when present, so keep those keys consistent if produced upstream.
- **Price & content displays**: `Price` pills query `price`, `current_price`, or `last_price`. `Price Change` needs `price` and `price_change_percentage_24h` to compute absolute deltas. `Volume` content expects the same fields as volume sizing. Missing numbers default to `0`, which suppresses labels.
- **Price range filter dependency**: `App.jsx` filters using `price` (falling back to `close`). Provide numeric `price` so the footer slider continues to work.
- **Selected index fidelity**: when `selectedIndex` is active, the chart renders every member (no cap). Ensure index membership lists produced by the pipeline use lowercase-able `symbol` strings that match the bubble data.

## 2. Interval Pill Aggregation Validation
- **Source logic**: `avgFavPctForInterval(interval)` (see `src/App.jsx`) averages favorites’ `price_change_percentage_24h` after running `approxPctForInterval`. Each interval currently derives from 24h pct via deterministic scaling factors (Hour = ÷24, Week = ×7, etc.).
- **Pipeline check**:
  1. Confirm the new pipeline can emit real interval change percentages (preferred) or maintain the existing 24h pct field for the fallback logic.
  2. For each pill interval, compute the expected average across the favorites list (or top 10 when favorites empty). Compare against UI output; tolerance should account for rounding to two decimals in titles/tooltips.
  3. When supplying true multi-interval data, update `approxPctForInterval` accordingly and verify the Map passed via `aggregations` resolves by `symbol`/`id`. The chart uses the aggregation value for size and color whenever `selections.size === 'Performance'`.
- **Visual cues**: the pill row and `PillMenu` color swatches call `pctToColor` with the aggregated pct. Validate that positive intervals render green gradients, negatives red, and near-zero stays neutral gray.
- **Multi/single mode parity**: ensure interval-driven percent values feed both multi-node ring colors and single-bubble sizing. In single view the component picks the largest absolute pct using the same data, so double-check both views while switching pills.

## 3. Fallback & No-Data Behaviour
- **Empty dataset**: if `coins` resolves falsy or empty, `App.jsx` shows a centered support message (“No chart data available”) with snapshot counts and recovery buttons. Confirm the pipeline surfaces `coins.length === 0` when upstream fetch returns nothing so the fallback appears.
- **BubbleChart guard**: the component clears its SVG and exits when `data` is empty. No partial DOM should remain—validate by observing that the svg stays blank without lingering defs or nodes after pipeline swaps.
- **Error resilience**: upstream hooks (`useCoins`) set `error` states surfaced in the header. When testing pipeline failures, confirm the header still displays the error string and that retry buttons (`Refresh interval`, `Re-import snapshots`) activate data reload paths.
- **Metadata merge**: even in fallback states, metadata lookup (`getAllMetadata`) should not throw. If pipeline output changes symbol casing, ensure metadata keys are updated or normalized to avoid silent missing logos once data resumes.

## 4. Regression Smoke Tests
- Toggle between *Performance*, *Market Cap*, and *Volume* sizing to verify ring radii respond to the matching field (check a sample coin’s raw values).
- Switch `single` view via the header toggle; expect identical color/label logic and a centered bubble sized by the active metric.
- Adjust the footer price range slider; confirm filtered coins disappear/return without breaking BubbleChart ordering or visible-count overlay.
- Trigger favorites/page menus and compare their avg pct readouts with manual calculations from the pipeline export.

Document these checks in the release runbook so future pipeline updates preserve BubbleChart stability without code diffs.


















# Breakout Analysis and Screener Debugging Plan

## Goal Description
1.  **Analyze Breakouts**: Create a script to scan the local QuestDB data (which the user updated with a CSV) for "breakout" events using a 50-tick interval basis. Identify when price jumps significantly and output these events.
2.  **Debug Screener**: Investigate why `Pre-Breakout Warning` and `Breakout Active` filters are returning 0 results. Use the existing `debug-screener.mjs` script to diagnose and potentially relax thresholds or fix data issues.

## User Review Required
> [!IMPORTANT]
> The definition of "breakout" for the analysis script will initially be defined as a **>1% price increase within a 50-tick window** combined with **RVOL > 1.5**. Please confirm if you have specific parameters for what constitutes a "breakout" (e.g., specific percentage, volume multiplier).

## Proposed Changes

### Breakout Analysis Script
#### [NEW] [analyze-breakouts-50ticks.mjs](file:///c:/Users/786/SHAHZAIB%20PROJECT/psxbubbles/scripts/analyze-breakouts-50ticks.mjs)
-   **Purpose**: standalone script to mine QuestDB for breakout events.
-   **Logic**:
    -   Connect to QuestDB.
    -   Fetch `trades` data.
    -   Group by 50-tick buckets (using `tick_seq % 50` or window functions).
    -   Calculate Price Change % and Volume for each bucket.
    -   Filter for buckets with Price Change > 1% (adjustable).
    -   Output list of `{symbol, timestamp, price_change, volume}`.

### Screener Debugging
#### [MODIFY] [server/api/routes/bubbles.mjs](file:///c:/Users/786/SHAHZAIB%20PROJECT/psxbubbles/server/api/routes/bubbles.mjs)
-   **Potential Change**: Relax thresholds for `isLeadWarning` if `debug-screener.mjs` reveals they are too strict.
    -   Current: `tightness < 0.015`, `vol_pulse > 3.0`, `proximity < 0.030`.
    -   Proposed (if needed): Relax `vol_pulse` to `2.0` or `tightness` to `0.02`.

#### [MODIFY] [debug-screener.mjs](file:///c:/Users/786/SHAHZAIB%20PROJECT/psxbubbles/debug-screener.mjs)
-   **Update**: Ensure it points to the correct local API URL and API Key if changed.

## Verification Plan

### Automated Tests
-   **Run Breakout Analysis**:
    ```powershell
    node scripts/analyze-breakouts-50ticks.mjs
    ```
    -   *Success Criteria*: Script runs without error and outputs a list of potential breakouts found in the data.

-   **Run Screener Debugger**:
    ```powershell
    node debug-screener.mjs
    ```
    -   *Success Criteria*: Script connects to API and outputs diagnostic data showing which conditions fail.

-   **Manual Verification**:
    -   Check the "Screener" dropdown in the UI (running via `npm run dev`).
    -   Verify that "Pre-Breakout Warning" now shows results (if thresholds are relaxed).

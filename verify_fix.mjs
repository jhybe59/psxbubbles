
import { queryQuestDB } from './server/api/questdb.mjs';

async function verifyFix() {
    console.log("--- Verifying Fix Logic ---");

    // 1. Check Max Timestamp Logic (Should be stable)
    console.log("Checking MAX(timestamp) logic...");
    const maxTsRes = await queryQuestDB("SELECT MAX(timestamp) FROM trades");
    let latestTs = null;
    if (maxTsRes && maxTsRes.dataset && maxTsRes.dataset.length > 0) {
        latestTs = maxTsRes.dataset[0][0];
        console.log("Confirmed Latest TS:", latestTs);
    } else {
        console.log("DB Empty/Error - timestamp check failed");
        return;
    }

    // 2. Emulate Day Interval with NEW logic
    console.log("\n--- Emulating NEW Day Interval Query ---");
    const anchorTs = latestTs;
    // Day logic: 
    // isDay = true. 
    // baseline_b logic: AND 1=0 (Skipped)
    // open = COALESCE(NULL, w.first_open, l.close) -> fallback to w.first_open (Session Open)
    // prev_day_stats is joined.

    // We need to calculate dateadd strings for the sql query
    // QuestDB requires single quotes for timestamp strings in dateadd if used as literals? 
    // actually dateadd(m, -5, '...::timestamp') is fine.

    const sqlDayFix = `
    WITH day_vols AS (
      SELECT symbol, sum(volume) as day_volume
      FROM trades
      WHERE timestamp >= dateadd('h', 4, date_trunc('day', '${anchorTs}'::timestamp))
      GROUP BY symbol
    ),
    prev_day_stats AS (
      -- ROBUST: Find the last known close BEFORE today's session open
      SELECT symbol, last(price) as prev_close, high as prev_high
      FROM (
        SELECT symbol, last(price) as close, max(price) as high, timestamp
        FROM trades
        WHERE timestamp < dateadd('h', 4, date_trunc('day', '${anchorTs}'::timestamp))
          AND timestamp >= dateadd('d', -7, dateadd('h', 4, date_trunc('day', '${anchorTs}'::timestamp)))
        SAMPLE BY 1m ALIGN TO CALENDAR
      ) LATEST ON timestamp PARTITION BY symbol
    ),
    latest_l AS (
      SELECT symbol, timestamp as ts, last(price) as close
      FROM trades
      WHERE timestamp >= dateadd('d', -7, '${anchorTs}'::timestamp) 
      SAMPLE BY 1m ALIGN TO CALENDAR
    ),
    latest_ordered AS (
      SELECT * FROM latest_l LATEST ON ts PARTITION BY symbol
    ),
    window_agg AS (
      SELECT 
        symbol,
        first(price) as first_open,
         max(price) as high,
        min(price) as low
      FROM trades
      WHERE timestamp >= dateadd('h', 4, date_trunc('day', '${anchorTs}'::timestamp))
      GROUP BY symbol
    )
    SELECT 
      l.symbol,
      l.close,
      pds.prev_close,
      w.first_open,
      -- This represents the "Open" used for % calculation
      COALESCE(NULL, w.first_open, l.close) as calc_open,
      -- Calculated Pct
      ((l.close - pds.prev_close) / pds.prev_close) * 100 as pct_change_vs_prev,
      ((l.close - w.first_open) / w.first_open) * 100 as pct_change_vs_open
    FROM latest_ordered l
    LEFT JOIN window_agg w ON l.symbol = w.symbol
    LEFT JOIN prev_day_stats pds ON l.symbol = pds.symbol
    LIMIT 10
  `;

    try {
        const res = await queryQuestDB(sqlDayFix);
        if (res && res.dataset) {
            console.table(res.dataset);
        } else {
            console.log("No result for Day Fix query");
        }
    } catch (e) {
        console.error("Day Fix Query Failed:", e);
    }
}

verifyFix();

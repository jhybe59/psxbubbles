
import { queryQuestDB } from './server/api/questdb.mjs';

async function diagnose() {
    console.log("--- Starting Diagnosis ---");

    // 1. Check Max Timestamp
    console.log("Checking MAX(timestamp) from trades...");
    const maxTsRes = await queryQuestDB("SELECT MAX(timestamp) FROM trades");
    let latestTs = null;
    if (maxTsRes && maxTsRes.dataset && maxTsRes.dataset.length > 0) {
        latestTs = maxTsRes.dataset[0][0];
        console.log("Latest TS in DB:", latestTs);
    } else {
        console.log("Could not get MAX(timestamp). DB might be empty or unreachable.");
        // Force a fallback to see what happens (simulating the bug condition if it fails)
        latestTs = new Date().toISOString();
        console.log("Fallback Latest TS:", latestTs);
    }

    if (!latestTs) return;

    // 2. Check 1m Interval Logic
    console.log("\n--- Testing 1m Interval Logic ---");
    // Emulate buildAggregatedQuery logic for 1m
    const minutes = 1;
    const anchorTs = latestTs; // mimicking what bubbles.mjs does if it finds a TS

    // Note: timestamps in QuestDB query need to be handled carefuly.
    // In bubbles.mjs: dateadd('m', -${minutes}, '${anchorTs}'::timestamp)

    const sql1m = `
    WITH window_agg AS (
      SELECT 
        symbol,
        first(price) as first_open,
        max(price) as high,
        min(price) as low,
        sum(volume) as volume,
        sum(value) as value
      FROM trades
      WHERE timestamp > dateadd('m', -${minutes}, '${anchorTs}'::timestamp)
      GROUP BY symbol
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
    baseline_b AS (
      SELECT symbol, timestamp, last(price) as baseline_close
      FROM trades
      WHERE timestamp <= dateadd('m', -${minutes}, '${anchorTs}'::timestamp)
        AND timestamp >= dateadd('d', -7, '${anchorTs}'::timestamp)
      SAMPLE BY 1m ALIGN TO CALENDAR
    ),
    baseline_ordered AS (
      SELECT * FROM baseline_b LATEST ON timestamp PARTITION BY symbol
    )
    SELECT 
      l.symbol,
      l.ts,
      COALESCE(b.baseline_close, w.first_open, l.close) as open,
      l.close,
      (l.close - COALESCE(b.baseline_close, w.first_open, l.close)) as diff,
      w.first_open as w_first_open,
      b.baseline_close as b_baseline_close
    FROM latest_ordered l
    LEFT JOIN window_agg w ON l.symbol = w.symbol
    LEFT JOIN baseline_ordered b ON l.symbol = b.symbol
    LIMIT 5
  `;

    try {
        const res1m = await queryQuestDB(sql1m);
        if (res1m && res1m.dataset) { // Added check for dataset
            console.table(res1m.dataset.slice(0, 5));
        } else {
            console.log("No result for 1m query");
        }
    } catch (e) {
        console.error("1m Query Failed:", e);
    }

    // 3. Check Day Interval Logic
    console.log("\n--- Testing Day Interval Logic ---");
    // In bubbles.mjs, minutesMap['Day'] is undefined, so it defaults to 5.
    // BUT isDay = true uses todayOpen.

    const isDay = true;
    // Calculate todayOpen based on anchorTs
    // const todayOpen = `dateadd('h', 4, date_trunc('day', '${anchorTs}'::timestamp))`;
    // We'll emulate the query:

    const sqlDay = `
    WITH day_vols AS (
      SELECT symbol, sum(volume) as day_volume
      FROM trades
      WHERE timestamp >= dateadd('h', 4, date_trunc('day', '${anchorTs}'::timestamp))
      GROUP BY symbol
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
    ),
     baseline_b AS (
      -- NOTE: bubbles.mjs calculates baseline_b using 'minutes' variable.
      -- If interval='Day', minutes=5 (default).
      -- So it looks back 5 minutes from anchorTs!
      SELECT symbol, timestamp, last(price) as baseline_close
      FROM trades
      WHERE timestamp <= dateadd('m', -5, '${anchorTs}'::timestamp)
        AND timestamp >= dateadd('d', -7, '${anchorTs}'::timestamp)
      SAMPLE BY 1m ALIGN TO CALENDAR
    ),
    baseline_ordered AS (
      SELECT * FROM baseline_b LATEST ON timestamp PARTITION BY symbol
    )
    SELECT 
      l.symbol,
      l.close,
      COALESCE(b.baseline_close, w.first_open, l.close) as open_calculated,
      b.baseline_close,
      w.first_open
    FROM latest_ordered l
    LEFT JOIN window_agg w ON l.symbol = w.symbol
    LEFT JOIN baseline_ordered b ON l.symbol = b.symbol
    LIMIT 5
  `;

    try {
        const resDay = await queryQuestDB(sqlDay);
        if (resDay && resDay.dataset) { // Added check for dataset
            console.table(resDay.dataset.slice(0, 5));
        } else {
            console.log("No result for Day query");
        }
    } catch (e) {
        console.error("Day Query Failed:", e);
    }

}

diagnose();

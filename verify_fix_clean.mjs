
import { queryQuestDB } from './server/api/questdb.mjs';

async function verifyFixClean() {
  console.log("--- Verifying Fix Logic (Clean) ---");

  const maxTsRes = await queryQuestDB("SELECT MAX(timestamp) FROM trades");
  let latestTs = null;
  if (maxTsRes && maxTsRes.dataset && maxTsRes.dataset.length > 0) {
    latestTs = maxTsRes.dataset[0][0];
    console.log("Latest TS:", latestTs);
  } else {
    console.log("DB Empty/Error");
    return;
  }

  const anchorTs = latestTs;

  // Emulate Day Interval Logic with NO comments
  const sqlDayFix = `
    WITH day_vols AS (
      SELECT symbol, sum(volume) as day_volume
      FROM trades
      WHERE timestamp >= dateadd('h', 4, date_trunc('day', '${anchorTs}'::timestamp))
      GROUP BY symbol
    ),
    prev_day_stats AS (
      SELECT symbol, close as prev_close, high as prev_high
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
    ),
    day_agg AS (
      SELECT 
        symbol,
        max(price) as day_high,
        min(price) as day_low
      FROM trades
      WHERE timestamp >= dateadd('h', 4, date_trunc('day', '${anchorTs}'::timestamp))
      GROUP BY symbol
    )
    SELECT 
      l.symbol,
      l.close,
      COALESCE(pds.prev_high, 0) as prev_high,
      COALESCE(pds.prev_close, 0) as prev_close,
      wa.first_open,
      da.day_high,
      da.day_low
    FROM latest_ordered l
    LEFT JOIN window_agg wa ON l.symbol = wa.symbol
    LEFT JOIN prev_day_stats pds ON l.symbol = pds.symbol
    LEFT JOIN day_agg da ON l.symbol = da.symbol
    LIMIT 10
  `;

  try {
    const res = await queryQuestDB(sqlDayFix);
    if (res && res.dataset) {
      console.table(res.dataset.slice(0, 10));
    } else {
      console.log("No result for Day Fix query");
    }
  } catch (e) {
    console.error("Day Fix Query Failed:", e);
  }
}

verifyFixClean();

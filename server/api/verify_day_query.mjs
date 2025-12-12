import { queryQuestDB } from './questdb.mjs';

async function run() {
    console.log('--- VERIFYING DAY QUERY LOGIC ---');

    // This mirrors the logic added to bubbles.mjs for 'Day'
    const sql = `
    WITH latest AS (
      SELECT symbol, timestamp as ts, close, daily_pct
      FROM minute_bars
      LATEST ON timestamp PARTITION BY symbol
    ),
    day_vols AS (
      SELECT symbol, sum(volume) as day_volume
      FROM trades
      WHERE timestamp >= date_trunc('day', now())
      GROUP BY symbol
    ),
    window_agg AS (
      SELECT 
        symbol,
        first(open) as first_open,
        max(high) as high,
        min(low) as low,
        sum(volume) as volume,
        sum(value) as value
      FROM minute_bars
      WHERE timestamp >= date_trunc('day', now())
      GROUP BY symbol
    )
    SELECT 
      l.symbol,
      l.ts,
      COALESCE(w.first_open, l.close) as open,
      GREATEST(COALESCE(w.high, l.close), l.close) as high,
      LEAST(COALESCE(w.low, l.close), l.close) as low,
      l.close,
      COALESCE(w.volume, 0) as volume,
      COALESCE(w.value, 0) as value,
      l.daily_pct,
      COALESCE(dv.day_volume, 0) as day_volume
    FROM latest l
    LEFT JOIN window_agg w ON l.symbol = w.symbol
    LEFT JOIN day_vols dv ON l.symbol = dv.symbol
    WHERE l.symbol = 'DOL'
  `;

    try {
        const result = await queryQuestDB(sql);
        if (!result || !result.dataset) {
            console.log("No result returned");
            return;
        }

        // Parse result
        const cols = result.columns.map(c => c.name);
        const row = result.dataset[0];
        const data = {};
        cols.forEach((c, i) => data[c] = row[i]);

        console.log('Result for DOL:', data);

        // Verification Checks
        const high = data.high;
        const low = data.low;
        const close = data.close;

        console.log('\n--- CONSISTENCY CHECKS ---');
        console.log(`High (${high}) >= Close (${close})?`, high >= close ? 'PASS' : 'FAIL');
        console.log(`Low (${low}) <= Close (${close})?`, low <= close ? 'PASS' : 'FAIL');

    } catch (err) {
        console.error("Query Failed:", err);
    }
}

run().catch(console.error).finally(() => process.exit());

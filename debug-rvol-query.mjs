
import { queryQuestDB } from './server/api/questdb.mjs';
import { config } from './server/api/config.mjs';
config.questdb = { host: '127.0.0.1', httpPort: 9000 };

async function debugRVOL() {
    console.log('--- Debugging RVOL Query (Latest Row) ---');
    const symbol = 'TRSM';
    // Use the max timestamp we found + 1 hour to simulate "now" being slightly after
    // Or just use 'now()' if we assume DB time is consistent.
    // Let's use specific anchor to match the data end.
    const anchor = "'2025-12-18T12:00:00.000000Z'::timestamp";
    const lookback = 20;

    // 1. Debug 1h RVOL (Latest)
    console.log('\n--- 1h RVOL Query (Latest) ---');
    const sql1h = `
    WITH stats AS (
      SELECT 
        symbol,
        timestamp as ts,
        sum(volume) as vol
      FROM minute_bars
      WHERE symbol = '${symbol}' AND timestamp <= ${anchor}
      SAMPLE BY 1h ALIGN TO CALENDAR TIME ZONE 'Asia/Karachi'
    ),
    with_avg AS (
      SELECT 
        symbol,
        vol,
        ts,
        avg(vol) OVER (PARTITION BY symbol ORDER BY ts ROWS BETWEEN ${lookback} PRECEDING AND 1 PRECEDING) as avg_vol,
        row_number() OVER (PARTITION BY symbol ORDER BY ts DESC) as rnk
      FROM stats
    )
    SELECT * FROM with_avg
    WHERE rnk = 1
    `;

    try {
        const res = await queryQuestDB(sql1h);
        if (res.dataset.length > 0) {
            console.log('Latest 1h Row:', res.dataset[0]);
            const vol = res.dataset[0][1];
            const avg = res.dataset[0][3];
            console.log(`RVOL = ${vol} / ${avg} = ${avg ? (vol / avg).toFixed(2) : 'NaN'}`);
        } else {
            console.log('No 1h data found for latest bucket');
        }
    } catch (err) {
        console.error('1h Query Failed:', err);
    }

    // 2. Debug 1d RVOL (Latest)
    console.log('\n--- 1d RVOL Query (Latest) ---');
    const sqlDay = `
    WITH stats AS (
      SELECT 
        symbol,
        timestamp as ts,
        sum(volume) as vol
      FROM minute_bars
      WHERE symbol = '${symbol}' AND timestamp <= ${anchor}
      SAMPLE BY 1d ALIGN TO CALENDAR TIME ZONE 'Asia/Karachi'
    ),
    with_avg AS (
      SELECT 
        symbol,
        vol,
        ts,
        avg(vol) OVER (PARTITION BY symbol ORDER BY ts ROWS BETWEEN ${lookback} PRECEDING AND 1 PRECEDING) as avg_vol,
        row_number() OVER (PARTITION BY symbol ORDER BY ts DESC) as rnk
      FROM stats
    )
    SELECT * FROM with_avg
    WHERE rnk = 1
    `;

    try {
        const res = await queryQuestDB(sqlDay);
        if (res.dataset.length > 0) {
            console.log('Latest 1d Row:', res.dataset[0]);
            const vol = res.dataset[0][1];
            const avg = res.dataset[0][3];
            console.log(`RVOL = ${vol} / ${avg} = ${avg ? (vol / avg).toFixed(2) : 'NaN'}`);
        } else {
            console.log('No 1d data found for latest bucket');
        }
    } catch (err) {
        console.error('Day Query Failed:', err);
    }
}

debugRVOL();

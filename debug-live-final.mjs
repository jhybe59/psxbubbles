const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

// The Exact SQL we put in bubbles.mjs for buildLatestQuery
const latestSql = `
    WITH latest_1m AS (
      SELECT 
        symbol,
        timestamp as ts,
        first(price) as open,
        max(price) as high,
        min(price) as low,
        last(price) as close,
        sum(volume) as volume,
        sum(value) as value
      FROM trades
      WHERE timestamp >= dateadd('d', -1, now()) 
       -- symbol filter removed for broad test
      SAMPLE BY 1m ALIGN TO CALENDAR
    ),
    latest_final AS (
      SELECT * FROM latest_1m LATEST ON ts PARTITION BY symbol
    ),
    prev_day AS (
       -- Get last price before today's open (04:00 UTC)
       SELECT symbol, close as prev_close
       FROM (
         SELECT symbol, last(price) as close, timestamp
         FROM trades
         WHERE timestamp < dateadd('h', 4, date_trunc('day', now()))
           AND timestamp >= dateadd('d', -7, dateadd('h', 4, date_trunc('day', now())))
           -- symbol filter removed
         SAMPLE BY 1m ALIGN TO CALENDAR
       ) LATEST ON timestamp PARTITION BY symbol
    )
    SELECT 
      l.symbol,
      l.ts,
      l.open,
      l.high,
      l.low,
      l.close,
      l.volume,
      l.value,
      CASE 
        WHEN p.prev_close IS NULL OR p.prev_close = 0 THEN 0 
        ELSE ((l.close - p.prev_close) / p.prev_close) * 100 
      END as daily_pct
    FROM latest_final l
    LEFT JOIN prev_day p ON l.symbol = p.symbol
`;

async function query(name, sql) {
    console.log(`\n--- TESTING: ${name} ---`);
    try {
        const res = await fetch(`${QUESTDB_URL}?query=${encodeURIComponent(sql)}`);
        if (!res.ok) {
            const txt = await res.text();
            console.error(`❌ FAILED (${res.status}): ${txt}`);
        } else {
            const json = await res.json();
            console.log(`✅ SUCCESS: Got ${json.count} rows`);
            if (json.dataset && json.dataset.length > 0) {
                console.log('Sample:', json.dataset[0]);
            }
        }
    } catch (err) {
        console.error('❌ EXCEPTION:', err.message);
    }
}

async function main() {
    await query('Latest Query Refactored', latestSql);

    // Check if tick_seq exists in trades
    await query('Check Tick Seq', "SELECT tick_seq FROM trades LIMIT 1");
}

main();

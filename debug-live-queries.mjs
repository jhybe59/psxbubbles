const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function query(name, sql) {
    console.log(`\n--- TESTING: ${name} ---`);
    try {
        const res = await fetch(`${QUESTDB_URL}?query=${encodeURIComponent(sql)}`);
        if (!res.ok) {
            const txt = await res.text();
            console.error(`❌ FAILED (${res.status}): ${txt}`);
        } else {
            const json = await res.json();
            console.log(`✅ SUCCESS: Got ${json.count} rows (or generic success)`);
            if (json.dataset && json.dataset.length > 0) {
                console.log('Sample Row:', json.dataset[0]);
            }
        }
    } catch (err) {
        console.error('❌ EXCEPTION:', err.message);
    }
}

async function main() {
    // 1. Test Latest Query (Simple)
    const latestSql = `
    SELECT * FROM (
        SELECT 
          symbol,
          timestamp as ts,
          first(price) as open,
          max(price) as high,
          min(price) as low,
          last(price) as close,
          sum(volume) as volume,
          sum(value) as value,
          last(daily_pct) as daily_pct
        FROM trades
        WHERE timestamp >= dateadd('d', -7, now())
        SAMPLE BY 1m ALIGN TO CALENDAR
    )
    LATEST ON ts PARTITION BY symbol
    `;
    await query('Latest Data (1m)', latestSql);

    // 2. Test Aggregated Query (Complex)
    // Using a fixed anchor for testing
    const anchorTs = new Date().toISOString();
    const todayOpen = `dateadd('h', 4, date_trunc('day', '${anchorTs}'::timestamp))`;

    // Simplified version of buildAggregatedQuery to isolate the issue
    const aggSql = `
    WITH day_vols AS (
      SELECT symbol, sum(volume) as day_volume
      FROM trades
      WHERE timestamp >= ${todayOpen}
      GROUP BY symbol
    ),
    latest_l AS (
      SELECT symbol, timestamp as ts, last(price) as close, last(daily_pct) as daily_pct
      FROM trades
      WHERE timestamp >= dateadd('d', -7, '${anchorTs}'::timestamp) 
      SAMPLE BY 1m ALIGN TO CALENDAR
    ),
    latest_ordered AS (
      SELECT * FROM latest_l LATEST ON ts PARTITION BY symbol
    )
    SELECT 
      l.symbol,
      l.close,
      COALESCE(dv.day_volume, 0) as day_volume
    FROM latest_ordered l
    LEFT JOIN day_vols dv ON l.symbol = dv.symbol
    `;
    await query('Aggregated Query (Simplified)', aggSql);
}

main();

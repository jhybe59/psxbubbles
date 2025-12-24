// Debug script to test EACH query that bubbles API makes
const API_URL = 'http://localhost:9000/exec';

async function testQuery(name, sql) {
    try {
        const res = await fetch(`${API_URL}?query=${encodeURIComponent(sql)}`);
        const json = await res.json();
        if (json.error) {
            console.log(`❌ ${name}: ${json.error}`);
            return false;
        } else {
            console.log(`✅ ${name}: ${json.count || 0} rows`);
            return true;
        }
    } catch (err) {
        console.log(`❌ ${name}: Network error - ${err.message}`);
        return false;
    }
}

async function main() {
    console.log('=== Testing all bubbles.mjs queries ===\n');

    // 1. Anchor query
    await testQuery('Anchor (MAX timestamp)',
        "SELECT MAX(timestamp) FROM trades");

    // 2. Latest 1m Query (simple)
    await testQuery('Simple trades query',
        `SELECT symbol, last(price) as close FROM trades SAMPLE BY 1m ALIGN TO CALENDAR LIMIT 5`);

    // 3. buildLatestQuery CTE
    await testQuery('buildLatestQuery CTE', `
        WITH latest_1m AS (
          SELECT symbol, timestamp as ts, first(price) as open, max(price) as high, min(price) as low, last(price) as close, sum(volume) as volume, sum(value) as value
          FROM trades WHERE timestamp >= dateadd('d', -1, now())
          SAMPLE BY 1m ALIGN TO CALENDAR
        ),
        latest_final AS (
          SELECT * FROM latest_1m LATEST ON ts PARTITION BY symbol
        )
        SELECT l.symbol, l.ts, l.open, l.high, l.low, l.close, l.volume, l.value, 0 as daily_pct FROM latest_final l
    `);

    // 4. ORB Query - market open
    await testQuery('ORB Market Open', `
        SELECT MIN(timestamp) as first_tick FROM trades
        WHERE timestamp >= dateadd('h', 4, date_trunc('day', now()))
    `);

    // 5. RVOL Query
    await testQuery('RVOL Query', `
        SELECT symbol, timestamp as ts, sum(volume) as vol
        FROM trades
        WHERE timestamp <= now()
        SAMPLE BY 1m ALIGN TO CALENDAR TIME ZONE 'Asia/Karachi'
        LIMIT 5
    `);

    // 6. Volatility Query
    await testQuery('Volatility Query', `
        SELECT symbol, last(price) as close
        FROM trades
        WHERE timestamp >= dateadd('d', -1, now())
        SAMPLE BY 1m ALIGN TO CALENDAR
        LIMIT 5
    `);

    console.log('\n=== Done ===');
}

main();

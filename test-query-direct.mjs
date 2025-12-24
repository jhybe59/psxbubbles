// Test exact SQL query from buildLatestQuery
const QUESTDB_URL = 'http://localhost:9000/exec';

// This is the exact query from bubbles.mjs buildLatestQuery
const sql = `
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
      SAMPLE BY 1m ALIGN TO CALENDAR
    ),
    latest_final AS (
      SELECT * FROM latest_1m LATEST ON ts PARTITION BY symbol
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
      0 as daily_pct
    FROM latest_final l
`;

async function main() {
    console.log('Testing buildLatestQuery SQL...');
    console.log('URL:', QUESTDB_URL);

    try {
        const res = await fetch(`${QUESTDB_URL}?query=${encodeURIComponent(sql)}`);
        const json = await res.json();

        if (json.error) {
            console.error('SQL ERROR:', json.error);
            console.error('Position:', json.position);
        } else {
            console.log('SUCCESS! Rows:', json.count);
            if (json.dataset && json.dataset[0]) {
                console.log('First row:', json.dataset[0]);
            }
        }
    } catch (err) {
        console.error('Fetch failed:', err.message);
    }
}

main();

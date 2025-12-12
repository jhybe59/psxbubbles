import { queryQuestDB } from './questdb.mjs';

async function run() {
    const symbol = 'DOL';

    console.log('--- TIME CHECK ---');
    const timeCheck = await queryQuestDB(`SELECT now()`);
    console.log('DB Now:', timeCheck?.dataset);

    // 1. Check latest minute bar
    console.log('\n--- LATEST MINUTE BAR ---');
    const latStub = await queryQuestDB(`
    SELECT * FROM minute_bars 
    WHERE symbol = '${symbol}' 
    LATEST ON timestamp PARTITION BY symbol
  `);
    // Map columns to names for readability
    if (latStub && latStub.columns && latStub.dataset && latStub.dataset[0]) {
        const cols = latStub.columns.map(c => c.name);
        const row = latStub.dataset[0];
        const mapped = {};
        cols.forEach((c, i) => mapped[c] = row[i]);
        console.log(mapped);
    } else {
        console.log('No data found');
    }

    // 2. Check last 5 minute bars
    console.log('\n--- LAST 5 MINUTE BARS ---');
    const hist = await queryQuestDB(`
    SELECT timestamp, open, high, low, close, volume, value, daily_pct 
    FROM minute_bars 
    WHERE symbol = '${symbol}' 
    ORDER BY timestamp DESC 
    LIMIT 5
  `);
    console.log(hist?.dataset);

    // 3. Check aggregation logic raw parts (Day)
    console.log('\n--- AGGREGATION COMPONENTS ---');
    // Check day volume from trades
    const dayVol = await queryQuestDB(`
    SELECT sum(volume) FROM trades 
    WHERE symbol = '${symbol}' 
    AND timestamp >= date_trunc('day', now())
  `);
    console.log('Day Volume (Trades - Today):', dayVol?.dataset);

    // Check window agg (480 min)
    const winAgg = await queryQuestDB(`
    SELECT 
      min(low), max(high), sum(value), sum(volume)
    FROM minute_bars
    WHERE symbol = '${symbol}'
    AND timestamp > dateadd('m', -480, now())
  `);
    console.log('Window Agg (480m):', winAgg?.dataset);
}

run().catch(console.error).finally(() => process.exit());

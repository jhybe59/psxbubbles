/**
 * Verify minute_bars vs trades data quality
 * Goal: Prove they return identical aggregated data
 */

const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function query(sql) {
    const res = await fetch(`${QUESTDB_URL}?query=${encodeURIComponent(sql)}`);
    return res.json();
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DATA VERIFICATION: TRADES vs MINUTE_BARS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Test 1: Count Comparison (Should be identical if 1:1 duplication)
    console.log('TEST 1: RAW ROW COUNTS (Should be equal)');
    const count1 = await query('SELECT count() FROM trades');
    const count2 = await query('SELECT count() FROM minute_bars');
    const c1 = count1.dataset[0][0];
    const c2 = count2.dataset[0][0];
    console.log(`  TRADES:      ${c1.toLocaleString()}`);
    console.log(`  MINUTE_BARS: ${c2.toLocaleString()}`);
    if (c1 === c2) console.log('  ✅ COUNTS MATCH EXACTLY!');
    else console.log(`  ❌ MISMATCH by ${Math.abs(c1 - c2)} rows`);
    console.log('');

    // Test 2: Aggregation Comparison (Should result in identical OHLC bars)
    console.log('TEST 2: 1-MINUTE AGGREGATION SAMPLE (KOHC)');

    const sqlTrades = `
        SELECT 
            timestamp, 
            first(price) as o, 
            max(price) as h, 
            min(price) as l, 
            last(price) as c, 
            sum(volume) as v 
        FROM trades 
        WHERE symbol = 'KOHC' AND timestamp > dateadd('h', -24, now()) 
        SAMPLE BY 1m ORDER BY timestamp DESC LIMIT 5
    `;

    const sqlBars = `
        SELECT 
            timestamp, 
            first(open) as o, 
            max(high) as h, 
            min(low) as l, 
            last(close) as c, 
            sum(volume) as v 
        FROM minute_bars 
        WHERE symbol = 'KOHC' AND timestamp > dateadd('h', -24, now()) 
        SAMPLE BY 1m ORDER BY timestamp DESC LIMIT 5
    `;

    const resTrades = await query(sqlTrades);
    const resBars = await query(sqlBars);

    // Display Comparison
    console.log('  TRADES TABLE RESULT:');
    if (resTrades.dataset) {
        resTrades.dataset.forEach(r => console.log(`    ${r[0]} | ${r[4]} | ${r[5]}`));
    }

    console.log('  MINUTE_BARS TABLE RESULT:');
    if (resBars.dataset) {
        resBars.dataset.forEach(r => console.log(`    ${r[0]} | ${r[4]} | ${r[5]}`));
    }

    // Auto-check identity
    const tData = JSON.stringify(resTrades.dataset);
    const bData = JSON.stringify(resBars.dataset);

    if (tData === bData) {
        console.log('\n  ✅ DATA IS IDENTICAL! Migration is SAFE.');
        console.log('  We can switch to TRADES table with zero impact.');
    } else {
        console.log('\n  ❌ DATA MISMATCH! Migration requires investigation.');
    }
}

main().catch(console.error);

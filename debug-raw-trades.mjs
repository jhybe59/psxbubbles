/**
 * DEBUG: Check raw trades data distribution
 */

const QUESTDB_URL = 'http://localhost:9000/exec';

async function queryQuestDB(sql) {
    const encodedQuery = encodeURIComponent(sql);
    const response = await fetch(`${QUESTDB_URL}?query=${encodedQuery}&count=true`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
    return response.json();
}

async function checkRawTrades() {
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("DEBUG: Raw Trades Data Analysis");
    console.log("═══════════════════════════════════════════════════════════════════\n");

    // Check total trades count
    console.log("📊 TOTAL TRADES COUNT:");
    const totalSQL = `SELECT count() FROM trades`;
    const totalResult = await queryQuestDB(totalSQL);
    console.log(`   Total trades: ${totalResult?.dataset?.[0]?.[0] || 'N/A'}`);

    // Check today's trades specifically
    const dayStart = '2026-01-08T04:00:00.000Z';
    console.log("\n📊 TODAY'S TRADES (since 9:00 AM PKT):");
    const todaySQL = `
        SELECT count() FROM trades
        WHERE timestamp >= '${dayStart}'
    `;
    const todayResult = await queryQuestDB(todaySQL);
    console.log(`   Today's trades: ${todayResult?.dataset?.[0]?.[0] || 'N/A'}`);

    // Check the timestamp range of trades
    console.log("\n📊 TIMESTAMP RANGE:");
    const rangeSQL = `
        SELECT min(timestamp) as earliest, max(timestamp) as latest
        FROM trades
    `;
    const rangeResult = await queryQuestDB(rangeSQL);
    if (rangeResult?.dataset?.[0]) {
        console.log(`   Earliest: ${rangeResult.dataset[0][0]}`);
        console.log(`   Latest: ${rangeResult.dataset[0][1]}`);
    }

    // Check raw trades for PAEL
    console.log("\n📊 RAW TRADES FOR PAEL (today):");
    const pealTradesSQL = `
        SELECT timestamp, price, volume
        FROM trades
        WHERE symbol = 'PAEL' AND timestamp >= '${dayStart}'
        ORDER BY timestamp
        LIMIT 20
    `;
    const pealResult = await queryQuestDB(pealTradesSQL);
    if (pealResult?.dataset) {
        console.log(`   Found ${pealResult.count || pealResult.dataset.length} trades`);
        pealResult.dataset.slice(0, 10).forEach((row, i) => {
            console.log(`   ${i + 1}. ${row[0]} | P:${row[1]} | V:${row[2]}`);
        });
    }

    // Check trades distribution by hour
    console.log("\n📊 TRADES BY HOUR (today):");
    const hourSQL = `
        SELECT 
            date_trunc('hour', timestamp) as hr,
            count() as trades
        FROM trades
        WHERE timestamp >= '${dayStart}'
        SAMPLE BY 1h ALIGN TO CALENDAR
    `;
    const hourResult = await queryQuestDB(hourSQL);
    if (hourResult?.dataset) {
        hourResult.dataset.forEach(row => {
            console.log(`   ${row[0]}: ${row[1]} trades`);
        });
    }

    // Check unique symbols with trades today
    console.log("\n📊 SYMBOLS WITH TRADES TODAY:");
    const symbolsSQL = `
        SELECT symbol, count() as trades
        FROM trades
        WHERE timestamp >= '${dayStart}'
        GROUP BY symbol
        ORDER BY trades DESC
        LIMIT 15
    `;
    const symbolsResult = await queryQuestDB(symbolsSQL);
    if (symbolsResult?.dataset) {
        console.log(`   Total symbols: ${symbolsResult.count || symbolsResult.dataset.length}`);
        symbolsResult.dataset.forEach(row => {
            console.log(`   ${row[0]}: ${row[1]} trades`);
        });
    }
}

checkRawTrades().catch(console.error);

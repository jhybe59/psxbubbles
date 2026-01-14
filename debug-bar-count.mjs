/**
 * DEBUG: Check how many 1m bars QuestDB SAMPLE BY returns
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

async function checkBarCount() {
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("DEBUG: Checking 1m Bar Count per Symbol");
    console.log("═══════════════════════════════════════════════════════════════════\n");

    const dayStart = '2026-01-08T04:00:00.000Z';

    // Query 1: Count raw trades per symbol today
    console.log("📊 RAW TRADE COUNT per symbol (today):");
    const rawCountSQL = `
        SELECT symbol, count() as trade_count
        FROM trades
        WHERE timestamp >= '${dayStart}'
        GROUP BY symbol
        ORDER BY trade_count DESC
        LIMIT 10
    `;

    const rawResult = await queryQuestDB(rawCountSQL);
    if (rawResult?.dataset) {
        rawResult.dataset.forEach(row => {
            console.log(`   ${row[0]}: ${row[1]} trades`);
        });
    }

    // Query 2: Count SAMPLED 1m bars per symbol
    console.log("\n📊 SAMPLED 1m BAR COUNT per symbol (today):");
    const sampleCountSQL = `
        WITH m1_bars AS (
            SELECT 
                symbol,
                timestamp,
                first(price) as open,
                max(price) as high,
                min(price) as low,
                last(price) as close,
                sum(volume) as volume
            FROM trades
            WHERE timestamp >= '${dayStart}'
            SAMPLE BY 1m
        )
        SELECT symbol, count() as bar_count
        FROM m1_bars
        GROUP BY symbol
        ORDER BY bar_count DESC
        LIMIT 10
    `;

    const sampleResult = await queryQuestDB(sampleCountSQL);
    if (sampleResult?.dataset) {
        sampleResult.dataset.forEach(row => {
            console.log(`   ${row[0]}: ${row[1]} bars`);
        });
    }

    // Query 3: Check a specific symbol's 1m bars
    console.log("\n📊 Sample 1m BARS for PAEL:");
    const pealBarsSQL = `
        SELECT 
            symbol,
            timestamp,
            first(price) as open,
            max(price) as high,
            min(price) as low,
            last(price) as close,
            sum(volume) as volume
        FROM trades
        WHERE symbol = 'PAEL' AND timestamp >= '${dayStart}'
        SAMPLE BY 1m
        LIMIT 15
    `;

    const pealResult = await queryQuestDB(pealBarsSQL);
    if (pealResult?.dataset) {
        console.log(`   Found ${pealResult.dataset.length} bars`);
        pealResult.dataset.slice(0, 5).forEach(row => {
            console.log(`   ${row[1]} | O:${row[2]} H:${row[3]} L:${row[4]} C:${row[5]} V:${row[6]}`);
        });
    }

    // Query 4: Check actual lead indicator query result
    console.log("\n📊 Testing Lead Indicator Query (first 3 symbols):");
    const leadSQL = `
        WITH m1_bars AS (
            SELECT 
                symbol,
                timestamp,
                first(price) as open,
                max(price) as high,
                min(price) as low,
                last(price) as close,
                sum(volume) as volume
            FROM trades
            WHERE symbol IN ('PAEL', 'TREET', 'BBFL') AND timestamp >= '${dayStart}'
            SAMPLE BY 1m
        ),
        session_stats AS (
            SELECT 
                symbol,
                max(high) as session_high,
                count() as bar_count
            FROM m1_bars
            GROUP BY symbol
        )
        SELECT * FROM session_stats
    `;

    const leadResult = await queryQuestDB(leadSQL);
    if (leadResult?.dataset) {
        const cols = leadResult.columns.map(c => c.name);
        console.log(`   Columns: ${cols.join(', ')}`);
        leadResult.dataset.forEach(row => {
            console.log(`   ${row[0]}: session_high=${row[1]}, bar_count=${row[2]}`);
        });
    }
}

checkBarCount().catch(console.error);

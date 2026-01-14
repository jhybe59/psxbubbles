/**
 * Check historical data availability
 */
const QUESTDB_URL = 'http://localhost:9000/exec';

async function queryQuestDB(sql) {
    const encodedQuery = encodeURIComponent(sql);
    const response = await fetch(`${QUESTDB_URL}?query=${encodedQuery}&count=true`);
    return response.json();
}

async function checkHistoricalData() {
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("HISTORICAL DATA CHECK");
    console.log("═══════════════════════════════════════════════════════════════════\n");

    // Check trades by day
    console.log("📊 TRADES BY DAY (last 7 days):");
    const byDaySQL = `
        SELECT 
            date_trunc('day', timestamp) as day,
            count() as trades,
            count_distinct(symbol) as symbols
        FROM trades
        WHERE timestamp > dateadd('d', -7, now())
        SAMPLE BY 1d ALIGN TO CALENDAR
    `;
    const dayResult = await queryQuestDB(byDaySQL);
    if (dayResult?.dataset) {
        dayResult.dataset.forEach(row => {
            console.log(`   ${row[0]}: ${row[1]} trades, ${row[2]} symbols`);
        });
    }

    // Check if yesterday has proper data
    console.log("\n📊 YESTERDAY'S DATA SAMPLE:");
    const yesterdaySQL = `
        SELECT symbol, count() as trades
        FROM trades
        WHERE timestamp >= dateadd('h', 4, date_trunc('day', dateadd('d', -1, now())))
          AND timestamp < dateadd('h', 4, date_trunc('day', now()))
        GROUP BY symbol
        ORDER BY trades DESC
        LIMIT 10
    `;
    const yestResult = await queryQuestDB(yesterdaySQL);
    if (yestResult?.dataset) {
        console.log(`   Total symbols yesterday: ${yestResult.count || yestResult.dataset.length}`);
        yestResult.dataset.slice(0, 5).forEach(row => {
            console.log(`   ${row[0]}: ${row[1]} trades`);
        });
    }

    // Check if we can run the pre-breakout calculation on yesterday's data
    console.log("\n📊 TESTING PRE-BREAKOUT CALC ON YESTERDAY:");
    const yesterdayStart = '2026-01-07T04:00:00.000Z';
    const testSQL = `
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
            WHERE symbol IN ('PAEL', 'TREET', 'SAZEW') 
              AND timestamp >= '${yesterdayStart}'
              AND timestamp < dateadd('h', 4, date_trunc('day', now()))
            SAMPLE BY 1m ALIGN TO CALENDAR
        )
        SELECT symbol, count() as bar_count, max(timestamp) as last_bar
        FROM m1_bars
        GROUP BY symbol
    `;
    const testResult = await queryQuestDB(testSQL);
    if (testResult?.dataset) {
        testResult.dataset.forEach(row => {
            console.log(`   ${row[0]}: ${row[1]} bars, last: ${row[2]}`);
        });
    }
}

checkHistoricalData().catch(console.error);

import { queryQuestDB } from './server/api/questdb.mjs';

async function debugTickBubbles() {
    console.log("Debugging Tick Bubbles Day Volume...");

    // 1. Get latest timestamp
    const anchorRes = await queryQuestDB("SELECT MAX(timestamp) FROM trades");
    let latestTs = new Date().toISOString();
    if (anchorRes && anchorRes.dataset && anchorRes.dataset.length > 0 && anchorRes.dataset[0][0]) {
        latestTs = anchorRes.dataset[0][0];
    }
    console.log(`Latest Timestamp: ${latestTs}`);

    // 2. Simulate the day volume query from tick-bubbles.mjs
    // Note: In the file it was: timestamp >= dateadd('h', 4, date_trunc('day', '${latestTs}'))

    // Check what QuestDB thinks the start time is
    const checkTimeSql = `select dateadd('h', 4, date_trunc('day', '${latestTs}'::timestamp))`;
    try {
        const timeRes = await queryQuestDB(checkTimeSql);
        console.log(`Calculated Start Time (PKT Open): ${timeRes.dataset[0][0]}`);
    } catch (e) {
        console.error("Error calculating start time:", e);
    }

    const volHighLowSql = `
        SELECT 
            symbol, 
            sum(volume) as day_volume,
            max(price) as day_high,
            min(price) as day_low
        FROM trades
        WHERE timestamp >= dateadd('h', 4, date_trunc('day', '${latestTs}'::timestamp))
        GROUP BY symbol
        LIMIT 5
    `;

    console.log("\nExecuting Query:");
    console.log(volHighLowSql);

    const volResult = await queryQuestDB(volHighLowSql);

    if (volResult && volResult.dataset) {
        console.log(`\nFound ${volResult.dataset.length} rows.`);
        for (const row of volResult.dataset) {
            console.log(`Symbol: ${row[0]}, DayVol: ${row[1]}, High: ${row[2]}, Low: ${row[3]}`);
        }
    } else {
        console.log("No result or empty dataset.");
    }
}

debugTickBubbles().catch(console.error).finally(() => process.exit());

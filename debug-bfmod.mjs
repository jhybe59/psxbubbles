
const QUESTDB_URL = 'http://localhost:9000/exec';

async function queryQuestDB(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}&fmt=json`;
    console.log(`Querying: ${sql}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`QuestDB query failed: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Query Error:', error.message);
        return null;
    }
}

async function main() {
    // BFMOD Breakout Time from CSV: 1/6/2026, 11:41:54 AM
    // In ISO (PKT-5): 2026-01-06T06:41:54Z

    // Let's look at a 10 minute window around this time in UTC
    const sql = `
        SELECT timestamp, price, volume 
        FROM trades 
        WHERE symbol = 'BFMOD' 
        AND timestamp BETWEEN '2026-01-06T06:35:00.000000Z' AND '2026-01-06T06:45:00.000000Z'
    `;

    const result = await queryQuestDB(sql);
    console.log(JSON.stringify(result, null, 2));
}

main();

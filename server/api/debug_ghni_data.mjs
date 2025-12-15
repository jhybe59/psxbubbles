
import { queryQuestDB } from './questdb.mjs';

async function checkTrades() {
    console.log(`Checking trades for GHNI...`);
    try {
        const sql = `
            SELECT timestamp, price, volume, tick_seq
            FROM trades 
            WHERE symbol = 'GHNI' 
            ORDER BY timestamp DESC 
            LIMIT 20
        `;

        const result = await queryQuestDB(sql);

        if (!result || !result.dataset) {
            console.log("No data found or error.");
            return;
        }

        console.log(`Found ${result.count} rows.`);
        console.table(result.dataset);

    } catch (err) {
        console.error("Error:", err);
    }
}

checkTrades();

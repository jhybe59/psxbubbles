
import { queryQuestDB } from './questdb.mjs';

async function checkTrades() {
    console.log(`Checking volume for LUCK...`);
    try {
        const sql = `
            SELECT timestamp, volume, value, price
            FROM trades 
            WHERE symbol = 'LUCK' 
            ORDER BY timestamp DESC 
            LIMIT 10
        `;

        const result = await queryQuestDB(sql);

        if (!result || !result.dataset) {
            console.log("No data found or error.");
            return;
        }

        console.table(result.dataset.map(r => ({
            ts: r[0],
            vol: r[1],
            val: r[2],
            price: r[3]
        })));

    } catch (err) {
        console.error("Error:", err);
    }
}

checkTrades();

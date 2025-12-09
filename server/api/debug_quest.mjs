
import { queryQuestDB } from './questdb.mjs';

async function run() {
    try {
        console.log("Running debug query for 5m interval...");

        // This query matches the one in bubbles-quest.mjs but restricted to one symbol for clarity
        // We'll pick a symbol that exists, e.g., 'OGDC' or just limit 5
        const sql = `
        SELECT 
          symbol,
          timestamp as ts,
          first(open) as open,
          max(high) as high,
          min(low) as low,
          last(close) as close,
          sum(volume) as volume,
          sum(value) as value,
          last(daily_pct) as daily_pct
        FROM minute_bars
        SAMPLE BY 5m
        ORDER BY ts DESC, symbol
        LIMIT 20
        `;

        console.log("Query:", sql);
        const result = await queryQuestDB(sql);
        console.log("Result columns:", result.columns);
        console.log("Result rows (first 5):");
        if (result.dataset) {
            result.dataset.slice(0, 5).forEach(row => console.log(row));
        } else {
            console.log("No dataset returned");
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

run();

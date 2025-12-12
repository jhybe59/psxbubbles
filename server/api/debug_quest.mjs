
import { queryQuestDB } from './questdb.mjs';

async function run() {
    try {
        console.log("Fetching RAW data for ISL...");
        const sql = "SELECT symbol, timestamp, open, close, volume, value, daily_pct FROM minute_bars WHERE symbol = 'ISL' ORDER BY timestamp DESC LIMIT 10";
        console.log("Query:", sql);
        const result = await queryQuestDB(sql);
        if (result.dataset) {
            console.table(result.dataset);
        } else {
            console.log("No data found");
        }
    } catch (e) { console.error(e); }
}
run();

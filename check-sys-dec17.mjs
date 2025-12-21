
import { queryQuestDB } from './server/api/questdb.mjs';

async function checkRange() {
    const symbol = 'SYS';
    const sql = `SELECT timestamp, close FROM minute_bars WHERE symbol = '${symbol}' AND timestamp >= '2025-12-17T00:00:00Z' AND timestamp < '2025-12-18T04:00:00Z' LIMIT 5`;
    const res = await queryQuestDB(sql);
    console.log(`Data for ${symbol} on Dec 17:`, JSON.stringify(res.dataset, null, 2));
}

checkRange();

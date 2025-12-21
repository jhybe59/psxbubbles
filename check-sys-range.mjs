
import { queryQuestDB } from './server/api/questdb.mjs';

async function checkRange() {
    const symbol = 'SYS';
    const sql = `SELECT MIN(timestamp), MAX(timestamp), COUNT(*) FROM minute_bars WHERE symbol = '${symbol}'`;
    const res = await queryQuestDB(sql);
    console.log(`Range for ${symbol}:`, JSON.stringify(res.dataset, null, 2));
}

checkRange();

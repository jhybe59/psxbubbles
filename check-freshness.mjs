
import { queryQuestDB } from './server/api/questdb.mjs';

async function check() {
    try {
        const res = await queryQuestDB("SELECT MAX(timestamp) FROM minute_bars");
        console.log('Latest Timestamp in QuestDB:', JSON.stringify(res.dataset, null, 2));

        // Also check trades for raw ticks
        const resTrades = await queryQuestDB("SELECT MAX(timestamp) FROM trades");
        console.log('Latest Timestamp in Trades:', JSON.stringify(resTrades.dataset, null, 2));
    } catch (err) {
        console.error('Query Error:', err);
    }
}
check();

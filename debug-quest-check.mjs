
import { queryQuestDB } from './server/api/questdb.mjs';
import { initQuestDB } from './workers/ingestion/questdb.mjs';

async function check() {
    try {
        console.log('Checking QuestDB trades table...');
        const res = await queryQuestDB('SELECT count() FROM trades');
        console.log('Trades count:', res);

        console.log('Checking recent trades...');
        const recent = await queryQuestDB('SELECT * FROM trades ORDER BY timestamp DESC LIMIT 5');
        console.log('Recent trades:', recent);

        // Check if minute_bars table exists (should be error or empty)
        try {
            const mb = await queryQuestDB('SELECT count() FROM minute_bars');
            console.log('Minute bars count:', mb);
        } catch (e) {
            console.log('Minute bars table likely does not exist:', e.message);
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

check();

import { queryQuestDB } from './questdb.mjs';

async function run() {
    try {
        console.log('--- Querying recent minute_bars for NETSOL ---');
        const sql = `SELECT timestamp, close, volume FROM minute_bars WHERE symbol = 'NETSOL' ORDER BY timestamp DESC LIMIT 20`;
        const result = await queryQuestDB(sql);

        if (result && result.dataset) {
            console.log('Columns:', result.columns);
            result.dataset.forEach(row => {
                console.log(row.join(' | '));
            });
        } else {
            console.log('No data found or error', result);
        }

        console.log('\n--- Querying recent trades ---');
        const sql2 = `SELECT timestamp, symbol, price, volume FROM trades LIMIT 10`;
        const result2 = await queryQuestDB(sql2);

        if (result2 && result2.dataset) {
            console.log('Columns:', result2.columns);
            result2.dataset.forEach(row => {
                console.log(row.join(' | '));
            });
        }

    } catch (e) {
        console.error(e);
    }
}

run();

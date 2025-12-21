
import { queryQuestDB } from './server/api/questdb.mjs';

async function diagnose() {
    console.log('--- Database Diagnostics ---');

    const tables = ['minute_bars', 'trades'];

    for (const table of tables) {
        console.log(`\nTable: ${table}`);
        const rangeRes = await queryQuestDB(`SELECT MIN(timestamp), MAX(timestamp), COUNT(*) FROM ${table}`);
        if (rangeRes && rangeRes.dataset && rangeRes.dataset.length > 0) {
            const [min, max, count] = rangeRes.dataset[0];
            console.log(`  Min Timestamp: ${min}`);
            console.log(`  Max Timestamp: ${max}`);
            console.log(`  Total Rows: ${count}`);
        } else {
            console.log(`  Failed to get range for ${table}`);
        }
    }

    console.log('\n--- Checking for Symbols with Data ---');
    const symbolRes = await queryQuestDB(`SELECT symbol, count(*) FROM minute_bars SAMPLE BY 1d`);
    if (symbolRes && symbolRes.dataset) {
        console.log(`  Daily buckets count (aggregated): ${symbolRes.dataset.length}`);
    }
}

diagnose();

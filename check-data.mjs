
import { queryQuestDB } from './server/api/questdb.mjs';

// Monkey patch the base URL to force 127.0.0.1 to avoid localhost issues
import { config } from './server/api/config.mjs';
config.questdb = { host: '127.0.0.1', httpPort: 9000 };

async function checkData() {
    console.log('--- Checking Data Depth for RVOL ---');

    try {
        // 1. Check total minute bars
        const countRes = await queryQuestDB("SELECT count() FROM minute_bars");
        console.log('Total Minute Bars:', countRes.dataset[0][0]);

        // 2. Check depth for top 5 symbols
        const depthRes = await queryQuestDB(`
            SELECT symbol, count(), min(timestamp), max(timestamp)
            FROM minute_bars
            SAMPLE BY 1d
            LIMIT 5
        `); // This sample by might group too much, let's just group by symbol

        // Better depth check:
        const symbolDepth = await queryQuestDB(`
            SELECT symbol, count() as cnt, min(timestamp) as start_ts, max(timestamp) as end_ts
            FROM minute_bars
            LIMIT 5
        `);
        // Note: Group By symbol is expensive if not keyed, but LATEST works. 
        // Let's use a simpler approach: Get distinct symbols then count for one.

        const distinctSym = await queryQuestDB("SELECT distinct symbol FROM minute_bars LIMIT 3");
        const symbols = distinctSym.dataset.map(r => r[0]);
        console.log('Sample Symbols:', symbols);

        for (const sym of symbols) {
            console.log(`\nAnalyzing ${sym}...`);
            const rows = await queryQuestDB(`SELECT count() FROM minute_bars WHERE symbol = '${sym}'`);
            const cnt = rows.dataset[0][0];
            console.log(`  Row Count: ${cnt}`);

            const timeRes = await queryQuestDB(`SELECT min(timestamp), max(timestamp) FROM minute_bars WHERE symbol = '${sym}'`);
            console.log(`  Range: ${timeRes.dataset[0][0]} to ${timeRes.dataset[0][1]}`);

            // Check Aggregates for RVOL (1h)
            // RVOL needs > 1 bucket.
            const h1Res = await queryQuestDB(`
                SELECT timestamp, sum(volume) 
                FROM minute_bars 
                WHERE symbol = '${sym}' 
                SAMPLE BY 1h ALIGN TO CALENDAR
            `);
            console.log(`  1h Buckets: ${h1Res.dataset.length}`);
            if (h1Res.dataset.length > 0) {
                console.log(`    Last Bucket: ${h1Res.dataset[0]}`); // Descending? No, QuestDB default Ascending usually unless specified?
                // Wait, SAMPLE BY default order is ascending time.
                console.log(`    First Bucket: ${h1Res.dataset[0]}`);
                console.log(`    Last Bucket: ${h1Res.dataset[h1Res.dataset.length - 1]}`);
            }

            // Check Day Buckets
            const d1Res = await queryQuestDB(`
                SELECT timestamp, sum(volume) 
                FROM minute_bars 
                WHERE symbol = '${sym}' 
                SAMPLE BY 1d ALIGN TO CALENDAR
            `);
            console.log(`  1d Buckets: ${d1Res.dataset.length}`);
        }

    } catch (err) {
        console.error('Check failed:', err);
    }
}

checkData();

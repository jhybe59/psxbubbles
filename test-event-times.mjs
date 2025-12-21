import { queryQuestDB } from './server/api/questdb.mjs';
import { config } from './server/api/config.mjs';
config.questdb = { host: '127.0.0.1', httpPort: 9000 };

async function testEventQueries() {
    console.log('--- Testing Event Timestamp Queries (Robust) ---');

    // 1. Get Latest Timestamp
    const latestRes = await queryQuestDB("SELECT max(timestamp) FROM minute_bars");
    const latestTs = latestRes.dataset[0][0];
    if (!latestTs) return;

    // Day Start
    const datePart = latestTs.split('T')[0];
    const dayStart = `${datePart}T04:00:00.000000Z`;
    console.log(`Day Start: ${dayStart}`);

    // 2. Find Active Symbols
    console.log('Finding active symbols...');
    const activeRes = await queryQuestDB(`
        SELECT symbol, count() 
        FROM minute_bars 
        WHERE timestamp >= '${dayStart}' 
        GROUP BY symbol 
        ORDER BY 2 DESC 
        LIMIT 5
    `);

    if (!activeRes.dataset || activeRes.dataset.length === 0) {
        console.log('No active symbols found for this day.');
        return;
    }

    const symbols = activeRes.dataset.map(r => r[0]);
    console.log('Active Symbols:', symbols);

    // 3. Test Speed on Active Symbols
    console.log('\n--- Query Speed Test ---');
    const pStart = Date.now();

    await Promise.all(symbols.map(async (sym) => {
        // A. Get ORB High
        const oRes = await queryQuestDB(`
            SELECT max(high) 
            FROM minute_bars 
            WHERE symbol='${sym}' 
            AND timestamp >= '${dayStart}' 
            AND timestamp < dateadd('m', 30, '${dayStart}')
        `);
        const h = oRes.dataset[0]?.[0];

        if (h) {
            // B. Get First Breakout Time (Optimization: LIMIT 1)
            // Note: 'min(timestamp)' is efficient if indexed, but 'ORDER BY timestamp LIMIT 1' might be too.
            // QuestDB 'min(timestamp)' is usually fast.
            const bRes = await queryQuestDB(`
                SELECT min(timestamp) 
                FROM minute_bars 
                WHERE symbol='${sym}' 
                AND timestamp >= '${dayStart}' 
                AND close > ${h}
             `);
            // console.log(`${sym} ORB:${h} Breakout:${bRes.dataset[0]?.[0]}`);
        }
    }));

    const duration = Date.now() - pStart;
    console.log(`Parallel Duration for ${symbols.length} symbols: ${duration}ms`);
    console.log(`Avg per symbol: ${duration / symbols.length}ms`);
}

testEventQueries();

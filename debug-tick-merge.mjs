
import { queryQuestDB } from './server/api/questdb.mjs';
import rvolService from './server/api/services/rvol-service.mjs';

async function testTickBubblesLogic() {
    console.log('--- Simulating tick-bubbles endpoint logic ---');
    const tickCount = 100;
    const limit = tickCount * 150;

    // 1. Fetch Trades
    const sql = `
        SELECT symbol, price, volume, timestamp 
        FROM trades 
        ORDER BY timestamp DESC 
        LIMIT ${limit}
    `;
    const result = await queryQuestDB(sql);

    // 2. Build Bubbles
    const symbolData = new Map();
    for (const row of result.dataset) {
        const symbol = row[0];
        if (!symbolData.has(symbol)) symbolData.set(symbol, []);
        const ticks = symbolData.get(symbol);
        if (ticks.length < tickCount) ticks.push(row);
    }

    const bubbles = [];
    for (const [symbol] of symbolData.entries()) {
        bubbles.push({ symbol });
    }
    console.log(`Created ${bubbles.length} bubble objects`);

    // 3. Fetch RVOL
    try {
        const symbolsList = bubbles.map(b => b.symbol);
        console.log(`Fetching RVOL for ${symbolsList.length} symbols...`);
        const rvolMap = await rvolService.getBatchTickRVOL(symbolsList, tickCount, 20);
        console.log(`RVOL Map size: ${rvolMap.size}`);

        // 4. Merge
        let mergedCount = 0;
        let sample = null;
        for (const bubble of bubbles) {
            bubble.rvol = rvolMap.get(bubble.symbol) || 0;
            if (bubble.rvol > 0) mergedCount++;
            if (bubble.rvol > 0.5 && !sample) sample = bubble;
        }

        console.log(`Merged RVOL into ${mergedCount} bubbles`);
        if (sample) console.log('Sample bubble with RVOL:', sample);
        else console.log('No bubbles with RVOL > 0 found in simulation');

    } catch (err) {
        console.error('RVOL fetch failed:', err);
    }
}

testTickBubblesLogic();

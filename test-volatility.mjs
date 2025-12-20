
import { volatilityService } from './server/api/services/volatility-service.mjs';
import { queryQuestDB } from './server/api/questdb.mjs';

async function testVolatility() {
    console.log('--- Testing Volatility Engine (TTM Squeeze) ---');

    try {
        // 1. Get Top 5 Volume Symbols to test
        console.log('Fetching top symbols...');
        const symbolRes = await queryQuestDB(`
            SELECT distinct symbol FROM trades 
            LIMIT 5
        `);
        const symbols = symbolRes.dataset ? symbolRes.dataset.map(row => row[0]) : [];
        console.log('Testing with symbols:', symbols);

        // 2. Test Time-Based (1h)
        console.log('\n--- Testing 1h Interval ---');
        const h1Map = await volatilityService.getBatchSqueezeState(symbols, '1h');

        symbols.forEach(sym => {
            const data = h1Map.get(sym);
            if (data) {
                console.log(`Symbol: ${sym} (1h)`);
                console.log(`  Squeeze ON: ${data.squeeze_on ? 'YES ✅' : 'NO ❌'}`);
                console.log(`  BB Width: ${data.bb_width.toFixed(4)} | KC Width: ${data.kc_width.toFixed(4)}`);
                console.log(`  ATR: ${data.atr.toFixed(4)} | StdDev: ${data.stddev.toFixed(4)}`);
            } else {
                console.log(`Symbol: ${sym} - No Data`);
            }
        });

        // 3. Test Tick-Based (100 Ticks)
        console.log('\n--- Testing 100 Ticks Interval ---');
        const tickMap = await volatilityService.getBatchTickSqueeze(symbols, 100);

        symbols.forEach(sym => {
            const data = tickMap.get(sym);
            if (data) {
                console.log(`Symbol: ${sym} (100 Ticks)`);
                console.log(`  Squeeze ON: ${data.squeeze_on ? 'YES ✅' : 'NO ❌'}`);
                console.log(`  BB Width: ${data.bb_width.toFixed(4)} | KC Width: ${data.kc_width.toFixed(4)}`);
            } else {
                console.log(`Symbol: ${sym} - No Tick Data`);
            }
        });

    } catch (err) {
        console.error('Test failed:', err);
    }
}

testVolatility();

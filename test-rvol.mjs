/**
 * Debug script to test RVOL calculation
 */
import rvolService from './server/api/services/rvol-service.mjs';

async function testRVOL() {
    console.log('--- Testing Standalone RVOL Engine ---');

    // Test with some known symbols or just general batch
    const symbols = ['KEL', 'FFL', 'OGDC']; // Common PSX symbols
    const intervals = ['1m', '5m', '1h', 'Day'];

    for (const interval of intervals) {
        console.log(`\nTesting Interval: ${interval}`);
        try {
            const rvolMap = await rvolService.getBatchRVOL(symbols, interval, 20);
            symbols.forEach(s => {
                const val = rvolMap.get(s);
                console.log(`${s}: ${val !== undefined ? val.toFixed(4) : 'No Data'}`);
            });
        } catch (err) {
            console.error(`Error testing ${interval}:`, err.message);
        }
    }

    // Test Ticks
    const tickIntervals = [10, 100, 500, 1000];
    for (const tc of tickIntervals) {
        console.log(`\nTesting Ticks: ${tc}`);
        try {
            const rvolMap = await rvolService.getBatchTickRVOL(symbols, tc, 20);
            symbols.forEach(s => {
                const val = rvolMap.get(s);
                console.log(`${s}: ${val !== undefined ? val.toFixed(4) : 'No Data'}`);
            });
        } catch (err) {
            console.error(`Error testing ${tc} ticks:`, err.message);
        }
    }
}

testRVOL().then(() => process.exit(0));

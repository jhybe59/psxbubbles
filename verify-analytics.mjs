
import { getMarketStats } from './server/api/services/analytics.mjs';
import logger from './server/api/logger.mjs';

async function verify() {
    try {
        console.log('Testing 5m market stats...');
        const res5m = await getMarketStats('5m');
        console.log('5m Result:', JSON.stringify(res5m, null, 2));

        console.log('Testing Day market stats...');
        const resDay = await getMarketStats('Day');
        console.log('Day Result:', JSON.stringify(resDay, null, 2));

    } catch (err) {
        console.error('Verification failed:', err);
    }
}

// Mock redis if needed or ensure it connects
verify();

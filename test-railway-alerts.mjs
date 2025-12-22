/**
 * Test Railway production API for alerts
 */
async function testRailwayAlerts() {
    console.log('--- Testing Railway Production API ---');

    const apiKey = 'dev-api-key'; // Use same key as local

    try {
        // Test tick-bubbles endpoint on correct API subdomain
        const res = await fetch('https://api-production-7e76.up.railway.app/api/tick-bubbles?ticks=100', {
            headers: { 'x-api-key': apiKey }
        });

        if (!res.ok) {
            console.error('API Error:', res.status);
            const text = await res.text();
            console.error('Response:', text.slice(0, 500));
            return;
        }

        const text = await res.text();
        console.log('Raw response preview:', text.slice(0, 200));

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('JSON Parse Error - Response is not JSON');
            return;
        }

        console.log(`Total Symbols: ${data.length}`);

        // Check if alerts field exists
        const withAlerts = data.filter(d => d.alerts && d.alerts.length > 0);
        console.log(`Symbols with alerts: ${withAlerts.length}`);

        if (withAlerts.length > 0) {
            console.log('\n--- Sample Alerts from Railway ---');
            const sample = withAlerts.slice(0, 2);
            for (const coin of sample) {
                console.log(`\n${coin.symbol}:`);
                for (const alert of (coin.alerts || []).slice(0, 3)) {
                    console.log(`  [${alert.time}] ${alert.text}`);
                }
            }
        } else {
            console.log('\nNo alerts found in Railway response.');
            console.log('Checking first coin structure:');
            if (data[0]) {
                console.log('Has alerts field:', 'alerts' in data[0]);
                console.log('Alerts value:', data[0].alerts);
            }
        }
    } catch (err) {
        console.error('Fetch Error:', err.message);
    }
}

testRailwayAlerts();

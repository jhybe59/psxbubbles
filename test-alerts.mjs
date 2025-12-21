/**
 * Test script to verify alerts are included in API response
 */
async function testAlerts() {
    console.log('--- Testing Alerts in API Response ---');

    try {
        const res = await fetch('http://127.0.0.1:8080/api/bubbles?interval=Day', {
            headers: { 'x-api-key': 'dev-api-key' }
        });

        if (!res.ok) {
            console.error('API Error:', res.status, await res.text());
            return;
        }

        const data = await res.json();
        console.log(`Total Symbols: ${data.data.length}`);
        console.log(`Meta hasAlerts: ${data.meta.hasAlerts}`);

        // Find symbols with alerts
        const withAlerts = data.data.filter(d => d.alerts && d.alerts.length > 0);
        console.log(`Symbols with alerts: ${withAlerts.length}`);

        if (withAlerts.length > 0) {
            console.log('\n--- Sample Alerts ---');
            const sample = withAlerts.slice(0, 3);
            for (const coin of sample) {
                console.log(`\n${coin.symbol}:`);
                for (const alert of coin.alerts.slice(0, 5)) {
                    console.log(`  [${alert.time}] ${alert.text}`);
                }
            }
        } else {
            console.log('\nNo alerts found. This could mean:');
            console.log('1. No events occurred in the session');
            console.log('2. dayStart timestamp issue');
            console.log('3. ORB/prevDay data not populated');

            // Debug: Check if any symbol has ORB data
            const withOrb = data.data.filter(d => d.orb_high_5m || d.orb_high_15m);
            console.log(`\nSymbols with ORB data: ${withOrb.length}`);
        }
    } catch (err) {
        console.error('Fetch Error:', err.message);
    }
}

testAlerts();

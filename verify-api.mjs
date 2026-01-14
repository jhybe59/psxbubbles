// Node 24 has built-in fetch
const API_URL = 'http://localhost:8080/api/bubbles';
const API_KEY = 'dev-api-key';

async function verifyAPI() {
    console.log("Fetching bubbles from API...");
    const res = await fetch(API_URL, {
        headers: { 'X-API-Key': API_KEY }
    });
    const data = await res.json();

    if (!data.data) {
        console.log("No bubble data found in API response.");
        return;
    }

    const preBreakouts = data.data.filter(b => b.pre_breakout_signal);
    const breakouts = data.data.filter(b => b.breakout_signal);

    console.log(`\nAPI SUMMARY:`);
    console.log(`Total Bubbles: ${data.data.length}`);
    console.log(`Pre-Breakout Warnings: ${preBreakouts.length}`);
    console.log(`Active Breakouts: ${breakouts.length}`);

    if (preBreakouts.length > 0) {
        console.log("\nDetected Pre-Breakout Symbols:");
        preBreakouts.forEach(b => {
            console.log(`- ${b.symbol} | Pulse: ${b.lead_metrics.vol_pulse.toFixed(1)}x | Tightness: ${(b.lead_metrics.tightness * 100).toFixed(2)}% | Prox: ${(b.lead_metrics.proximity * 100).toFixed(2)}%`);
        });
    }

    // Check specific winners
    const winners = ['ZAL', 'FECTC', 'YOUW', 'SAZEW'];
    console.log("\nSpecific Winners Status:");
    winners.forEach(sym => {
        const b = data.data.find(x => x.symbol === sym);
        if (b) {
            console.log(`${sym}: BO=${b.breakout_signal}, PRE=${b.pre_breakout_signal}`);
        } else {
            console.log(`${sym}: Not found in current bubbles`);
        }
    });
}

verifyAPI().catch(console.error);


// Native fetch (Node 18+)
import 'dotenv/config';

async function verifyApi() {
    try {
        const port = process.env.PORT || process.env.API_PORT || 8080;
        const apiKey = process.env.API_KEY_PRIMARY || process.env.VITE_LIVE_API_KEY || '';

        console.log(`Fetching http://localhost:${port}/api/bubbles with Key len: ${apiKey.length}`);

        const res = await fetch(`http://localhost:${port}/api/bubbles`, {
            headers: {
                'x-api-key': apiKey
            }
        });
        if (!res.ok) {
            throw new Error(`Status: ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        console.log("API Response OK. Data count:", json.data.length);

        // Check for OBOY
        const oboy = json.data.find(b => b.symbol === 'OBOY');
        if (oboy) {
            console.log("OBOY Found:");
            console.log("  lead_metrics:", oboy.lead_metrics);
        } else {
            console.log("OBOY NOT FOUND in response.");
        }

        // Check random sample
        const sample = json.data.find(b => b.lead_metrics);
        if (sample) {
            console.log(`Sample with lead_metrics (${sample.symbol}):`, sample.lead_metrics);
        } else {
            console.log("NO SYMBOLS have lead_metrics.");
        }

    } catch (err) {
        console.error("Fetch failed:", err);
    }
}

verifyApi();

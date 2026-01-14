/**
 * DEBUG: Check what dayStart timestamp is being used
 * and how many bars are available for Lead Indicator calculation
 */

const API_URL = 'http://localhost:8080/api/bubbles';
const API_KEY = 'dev-api-key';

async function debugDayStart() {
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("DEBUG: Day Start and Data Availability");
    console.log("═══════════════════════════════════════════════════════════════════\n");

    // What dayStart does the backend calculate?
    const now = new Date();
    const dayStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0, 0, 0));
    const dayStartIso = dayStartDate.toISOString();

    console.log(`Current Time (Local): ${now.toLocaleString()}`);
    console.log(`Current Time (UTC): ${now.toISOString()}`);
    console.log(`Calculated dayStart (UTC): ${dayStartIso}`);
    console.log(`Calculated dayStart (PKT): ${new Date(dayStartIso).toLocaleString()}`);

    // Get latest trade timestamp from database
    console.log("\n📊 Checking Latest Trade Data...");

    // Call the raw QuestDB endpoint (if available) or check via API response
    const res = await fetch(API_URL, {
        headers: { 'X-API-Key': API_KEY }
    });
    const data = await res.json();

    if (data.data && data.data.length > 0) {
        // Find the bubble with a timestamp
        const withTs = data.data.filter(b => b.ts);
        if (withTs.length > 0) {
            const latestTs = new Date(withTs[0].ts);
            console.log(`\nLatest Bubble Timestamp: ${latestTs.toISOString()}`);
            console.log(`Latest Bubble Timestamp (PKT): ${latestTs.toLocaleString()}`);

            // Check if the dayStart is AFTER the latest data
            if (dayStartDate > latestTs) {
                console.log("\n⚠️  WARNING: dayStart is AFTER latest trade data!");
                console.log("   This means the Lead Indicator query returns no data!");
                console.log("   Possible fix: Use data-relative dayStart instead of NOW-based.");
            }
        }
    }

    // Check specific bubble data
    console.log("\n📋 Sample Bubble Lead Metrics:");
    if (data.data) {
        const sample = data.data.find(b => b.lead_metrics && b.lead_metrics.vol_pulse !== null);
        if (sample) {
            console.log(`Symbol: ${sample.symbol}`);
            console.log(`  Price: ${sample.price}`);
            console.log(`  Lead Metrics:`, sample.lead_metrics);
        } else {
            console.log("No bubble found with valid lead_metrics!");
        }
    }

    // What does the bubbles endpoint timestamp header say?
    console.log(`\nAPI Meta Timestamp: ${data.meta?.ts || 'N/A'}`);
}

debugDayStart().catch(console.error);

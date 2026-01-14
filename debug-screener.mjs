/**
 * DEEP DEBUG: Trace the full pipeline for Pre-Breakout Warning
 * Step 1: Check raw market data
 * Step 2: Check Lead Indicator calculation
 * Step 3: Check what API actually returns
 * Step 4: Check what conditions evaluate to
 */

const API_URL = 'http://localhost:8080/api/bubbles?limit=100';
const API_KEY = 'dev-api-key'; // Confirmed from config/dev.env

async function fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function deepDebug() {
    console.log("===================================================================");
    console.log("DEEP DEBUG: Pre-Breakout Screener Pipeline Analysis");
    console.log("===================================================================\n");

    // Step 1: Fetch API data
    console.log("STEP 1: Fetching API data...");
    try {
        const res = await fetchWithTimeout(API_URL, {
            headers: { 'X-API-Key': API_KEY }
        }, 10000);

        if (!res.ok) {
            console.log(`API Error: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.log(`   Response: ${text}`);
            return;
        }

        const data = await res.json();


        if (!data.data || data.data.length === 0) {
            console.log("NO DATA from API!");
            return;
        }

        console.log(`Got ${data.data.length} bubbles from API`);
        console.log(`   Timestamp: ${data.meta?.ts || 'N/A'}`);

        // Step 2: Check which bubbles have lead_metrics
        console.log("\n-------------------------------------------------------------------");
        console.log("STEP 2: Checking lead_metrics presence...");

        const withMetrics = data.data.filter(b => b.lead_metrics);
        const withoutMetrics = data.data.filter(b => !b.lead_metrics);

        console.log(`   Bubbles with lead_metrics: ${withMetrics.length}`);
        console.log(`   Bubbles without lead_metrics: ${withoutMetrics.length}`);

        if (withMetrics.length === 0) {
            console.log("\nCRITICAL: NO bubbles have lead_metrics!");
            console.log("   This means getLeadIndicatorMetrics() is returning empty Map or failing.");
            return;
        }

        // Step 3: Analyze the metrics values
        console.log("\n-------------------------------------------------------------------");
        console.log("STEP 3: Analyzing lead_metrics values...");

        // Golden Formula thresholds (from code)
        const TIGHTNESS_THRESHOLD = 0.015;    // < 0.015 required
        const VOL_PULSE_THRESHOLD = 3.0;      // > 3.0 required
        const PROXIMITY_THRESHOLD = 0.030;    // < 0.030 required

        let tightnessPass = 0;
        let volPulsePass = 0;
        let proximityPass = 0;
        let allPass = 0;

        // Find best candidates
        let topByTightness = [];
        let topByVolPulse = [];
        let topByProximity = [];

        for (const b of withMetrics) {
            const m = b.lead_metrics;

            const tight = m.tightness < TIGHTNESS_THRESHOLD;
            const pulse = m.vol_pulse > VOL_PULSE_THRESHOLD;
            const prox = m.proximity < PROXIMITY_THRESHOLD;

            if (tight) tightnessPass++;
            if (pulse) volPulsePass++;
            if (prox) proximityPass++;
            if (tight && pulse && prox) allPass++;

            topByTightness.push({ symbol: b.symbol, value: m.tightness });
            topByVolPulse.push({ symbol: b.symbol, value: m.vol_pulse });
            topByProximity.push({ symbol: b.symbol, value: m.proximity });
        }

        // Sort and get top 10
        topByTightness.sort((a, b) => a.value - b.value);
        topByVolPulse.sort((a, b) => b.value - a.value);
        topByProximity.sort((a, b) => a.value - b.value);

        console.log("\n   CONDITION RESULTS:");
        console.log(`   - Tightness < ${TIGHTNESS_THRESHOLD}: ${tightnessPass}/${withMetrics.length} pass`);
        console.log(`   - Vol Pulse > ${VOL_PULSE_THRESHOLD}: ${volPulsePass}/${withMetrics.length} pass`);
        console.log(`   - Proximity < ${PROXIMITY_THRESHOLD}: ${proximityPass}/${withMetrics.length} pass`);
        console.log(`   - ALL CONDITIONS: ${allPass}/${withMetrics.length} pass`);

        console.log("\n   TOP 10 BY TIGHTNESS (lowest is best, need < 0.015):");
        topByTightness.slice(0, 10).forEach((x, i) => {
            const status = x.value < TIGHTNESS_THRESHOLD ? 'PASS' : 'FAIL';
            console.log(`   ${i + 1}. ${x.symbol}: ${(x.value * 100).toFixed(3)}% ${status}`);
        });

        console.log("\n   TOP 10 BY VOLUME PULSE (highest is best, need > 3.0x):");
        topByVolPulse.slice(0, 10).forEach((x, i) => {
            const status = x.value > VOL_PULSE_THRESHOLD ? 'PASS' : 'FAIL';
            console.log(`   ${i + 1}. ${x.symbol}: ${x.value?.toFixed(2)}x ${status}`);
        });

        console.log("\n   TOP 10 BY PROXIMITY (lowest is best, need < 0.030):");
        topByProximity.slice(0, 10).forEach((x, i) => {
            const status = x.value < PROXIMITY_THRESHOLD ? 'PASS' : 'FAIL';
            console.log(`   ${i + 1}. ${x.symbol}: ${(x.value * 100).toFixed(2)}% from high ${status}`);
        });

        // Step 4: Find ALMOST passing candidates
        console.log("\n-------------------------------------------------------------------");
        console.log("STEP 4: Finding ALMOST passing candidates (2 out of 3 conditions)...");

        const almostPassing = withMetrics.filter(b => {
            const m = b.lead_metrics;
            const tight = m.tightness < TIGHTNESS_THRESHOLD;
            const pulse = m.vol_pulse > VOL_PULSE_THRESHOLD;
            const prox = m.proximity < PROXIMITY_THRESHOLD;
            const passCount = [tight, pulse, prox].filter(Boolean).length;
            return passCount === 2;
        });

        if (almostPassing.length > 0) {
            console.log(`   Found ${almostPassing.length} stocks passing 2/3 conditions:`);
            almostPassing.forEach(b => {
                const m = b.lead_metrics;
                console.log(`   - ${b.symbol}:`);
                console.log(`     Tightness: ${(m.tightness * 100).toFixed(3)}% ${m.tightness < TIGHTNESS_THRESHOLD ? 'PASS' : 'FAIL'}`);
                console.log(`     Vol Pulse: ${m.vol_pulse?.toFixed(2)}x ${m.vol_pulse > VOL_PULSE_THRESHOLD ? 'PASS' : 'FAIL'}`);
                console.log(`     Proximity: ${(m.proximity * 100).toFixed(2)}% ${m.proximity < PROXIMITY_THRESHOLD ? 'PASS' : 'FAIL'}`);
            });
        } else {
            console.log("   No stocks passing 2/3 conditions.");
        }

        // Step 5: Check pre_breakout_signal field
        console.log("\n-------------------------------------------------------------------");
        console.log("STEP 5: Checking pre_breakout_signal field in API response...");

        const withSignalTrue = data.data.filter(b => b.pre_breakout_signal === 1 || b.pre_breakout_signal === true);
        const withSignalFalse = data.data.filter(b => b.pre_breakout_signal === 0 || b.pre_breakout_signal === false);
        const withSignalMissing = data.data.filter(b => b.pre_breakout_signal === undefined || b.pre_breakout_signal === null);

        console.log(`   pre_breakout_signal = 1/true: ${withSignalTrue.length}`);
        console.log(`   pre_breakout_signal = 0/false: ${withSignalFalse.length}`);
        console.log(`   pre_breakout_signal = undefined/null: ${withSignalMissing.length}`);

        // Step 6: Check breakout signal conditions too
        console.log("\n-------------------------------------------------------------------");
        console.log("STEP 6: Checking Breakout Active conditions...");

        let squeezeOff = 0;
        let bbAboveKc = 0;
        let rvolAbove15 = 0;
        let aboveOrb5m = 0;
        let priceAboveOpen = 0;
        let breakoutPass = 0;

        for (const b of data.data) {
            const sqOff = b.squeeze_on === false;
            const bbKc = b.bb_width != null && b.kc_width != null && b.bb_width > b.kc_width;
            const rvol = (b.rvol || 0) >= 1.5;
            const orb = b.orb_high_5m != null && b.price > b.orb_high_5m;
            const aboveOpen = b.price > b.open;

            if (sqOff) squeezeOff++;
            if (bbKc) bbAboveKc++;
            if (rvol) rvolAbove15++;
            if (orb) aboveOrb5m++;
            if (aboveOpen) priceAboveOpen++;
            if (sqOff && bbKc && rvol && orb && aboveOpen) breakoutPass++;
        }

        console.log(`   squeeze_on === false: ${squeezeOff}/${data.data.length}`);
        console.log(`   bb_width > kc_width: ${bbAboveKc}/${data.data.length}`);
        console.log(`   RVOL >= 1.5: ${rvolAbove15}/${data.data.length}`);
        console.log(`   price > orb_high_5m: ${aboveOrb5m}/${data.data.length}`);
        console.log(`   price > open: ${priceAboveOpen}/${data.data.length}`);
        console.log(`   ALL BREAKOUT CONDITIONS: ${breakoutPass}/${data.data.length}`);

        // Step 7: Sample data inspection
        console.log("\n-------------------------------------------------------------------");
        console.log("STEP 7: Sample full bubble data (first 3 with metrics)...");

        withMetrics.slice(0, 3).forEach((b, i) => {
            console.log(`\n   [${i + 1}] ${b.symbol}:`);
            console.log(`   - price: ${b.price}`);
            console.log(`   - open: ${b.open}`);
            console.log(`   - rvol: ${b.rvol}`);
            console.log(`   - squeeze_on: ${b.squeeze_on}`);
            console.log(`   - bb_width: ${b.bb_width}`);
            console.log(`   - kc_width: ${b.kc_width}`);
            console.log(`   - orb_high_5m: ${b.orb_high_5m}`);
            console.log(`   - pre_breakout_signal: ${b.pre_breakout_signal}`);
            console.log(`   - breakout_signal: ${b.breakout_signal}`);
            console.log(`   - lead_metrics: ${JSON.stringify(b.lead_metrics)}`);
        });

        console.log("\n===================================================================");
        console.log("DEBUG COMPLETE");
        console.log("===================================================================");
    } catch (err) {
        console.error("Fetch failed:", err.message);
        return;
    }
}

deepDebug().catch(err => {
    console.error("Debug script failed:", err);
});

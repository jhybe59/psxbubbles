/**
 * Test Breakout Detection Logic
 * Query local API and check if breakout_signal is correctly set
 */

const LOCAL_API = 'http://localhost:8080/api';
const API_KEY = 'dev-api-key';

async function main() {
    console.log('=== TESTING BREAKOUT DETECTION ===\n');
    console.log('Testing tick-bubbles endpoint (100 ticks)...\n');

    try {
        // Test tick-bubbles endpoint
        const tickRes = await fetch(`${LOCAL_API}/tick-bubbles?ticks=100`, {
            headers: { 'x-api-key': API_KEY }
        });
        if (!tickRes.ok) {
            console.error('tick-bubbles API error:', tickRes.status);
            return;
        }

        const bubbles = await tickRes.json();
        console.log(`Total bubbles received: ${bubbles.length}\n`);

        if (bubbles.length === 0) {
            console.log('No data - market might be closed');
            return;
        }

        // Check if breakout_signal field exists
        const sample = bubbles[0];
        console.log('Fields available in bubble object:');
        console.log(Object.keys(sample).join(', '));
        console.log('');

        // Check breakout conditions for each bubble
        console.log('=== CHECKING BREAKOUT CONDITIONS ===\n');

        let breakoutsFound = 0;
        const conditionStats = {
            squeeze_off: 0,
            bb_gt_kc: 0,
            rvol_2x: 0,
            above_orb: 0,
            pct_positive: 0,
            all_conditions: 0
        };

        for (const b of bubbles) {
            // Count individual conditions
            if (b.squeeze_on === false) conditionStats.squeeze_off++;
            if (b.bb_width != null && b.kc_width != null && b.bb_width > b.kc_width) conditionStats.bb_gt_kc++;
            if ((b.rvol >= 2.0) || (b.relative_volume >= 2.0)) conditionStats.rvol_2x++;
            if (b.orb_high_30m != null && b.price > b.orb_high_30m) conditionStats.above_orb++;
            if (b.pct_interval > 0) conditionStats.pct_positive++;

            // Check if API set breakout_signal
            if (b.breakout_signal === true) {
                breakoutsFound++;
                console.log(`✅ BREAKOUT: ${b.symbol}`);
                console.log(`   Price: ${b.price?.toFixed(2)}`);
                console.log(`   RVOL: ${(b.rvol || b.relative_volume)?.toFixed(2)}x`);
                console.log(`   Pct Interval: ${b.pct_interval?.toFixed(2)}%`);
                console.log(`   ORB High 30m: ${b.orb_high_30m?.toFixed(2)}`);
                console.log(`   Squeeze: ${b.squeeze_on ? 'ON' : 'OFF'}`);
                console.log(`   BB Width: ${b.bb_width?.toFixed(4)}, KC Width: ${b.kc_width?.toFixed(4)}`);
                console.log('');
            }
        }

        console.log('=== CONDITION STATS ===\n');
        console.log(`Squeeze OFF: ${conditionStats.squeeze_off} / ${bubbles.length}`);
        console.log(`BB > KC: ${conditionStats.bb_gt_kc} / ${bubbles.length}`);
        console.log(`RVOL >= 2.0: ${conditionStats.rvol_2x} / ${bubbles.length}`);
        console.log(`Price > ORB 30m: ${conditionStats.above_orb} / ${bubbles.length}`);
        console.log(`Pct Interval > 0: ${conditionStats.pct_positive} / ${bubbles.length}`);
        console.log('');

        console.log('=== RESULT ===\n');
        if (breakoutsFound > 0) {
            console.log(`🚀 ${breakoutsFound} BREAKOUT(S) DETECTED!`);
        } else {
            console.log('⚠️ No breakouts found.');
            console.log('This is expected if:');
            console.log('  - Market is closed (no live data)');
            console.log('  - No symbols meet ALL 5 conditions');
            console.log('');

            // Show symbols closest to breakout
            console.log('=== SYMBOLS CLOSEST TO BREAKOUT ===\n');
            const scored = bubbles.map(b => {
                let score = 0;
                if (b.squeeze_on === false) score++;
                if (b.bb_width != null && b.kc_width != null && b.bb_width > b.kc_width) score++;
                if ((b.rvol >= 2.0) || (b.relative_volume >= 2.0)) score++;
                if (b.orb_high_30m != null && b.price > b.orb_high_30m) score++;
                if (b.pct_interval > 0) score++;
                return { ...b, score };
            });

            scored.sort((a, b) => b.score - a.score);

            for (const b of scored.slice(0, 5)) {
                console.log(`${b.symbol}: ${b.score}/5 conditions met`);
                console.log(`  squeeze_off=${b.squeeze_on === false}, bb>kc=${b.bb_width > b.kc_width}, rvol=${(b.rvol || 0)?.toFixed(2)}x, above_orb=${b.price > b.orb_high_30m}, pct=${b.pct_interval?.toFixed(2)}%`);
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

main();

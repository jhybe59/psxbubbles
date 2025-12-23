/**
 * Check Railway API for TTM Squeeze Breakout conditions
 * Query the actual bubbles API which has all calculated fields
 */

const RAILWAY_API = 'https://psxbubbles.up.railway.app/api';

async function main() {
    console.log('=== CHECKING RAILWAY API FOR BREAKOUT CONDITIONS ===\n');
    console.log('Date: 2025-12-22 (Sunday - Market Closed)');
    console.log('Using stored data from last trading session\n');

    try {
        // Query Day interval bubbles API
        console.log('Fetching Day interval data from Railway API...\n');
        const res = await fetch(`${RAILWAY_API}/bubbles?interval=Day&_t=${Date.now()}`);

        if (!res.ok) {
            console.error('API Error:', res.status, res.statusText);
            return;
        }

        const json = await res.json();
        const symbols = json.data || json.symbols || [];

        console.log(`Total symbols received: ${symbols.length}\n`);

        if (symbols.length === 0) {
            console.log('No data received');
            return;
        }

        // Check which fields are available
        const sample = symbols[0];
        console.log('Available fields:', Object.keys(sample).join(', '));
        console.log('');

        // Check TTM Squeeze conditions
        console.log('=== CHECKING EACH CONDITION ===\n');

        // 1. Squeeze Status
        const squeezeOn = symbols.filter(s => s.squeeze_on === true);
        const squeezeOff = symbols.filter(s => s.squeeze_on === false);
        console.log(`Squeeze ON (compressing): ${squeezeOn.length} symbols`);
        console.log(`Squeeze OFF (expanding): ${squeezeOff.length} symbols`);
        console.log('');

        // 2. Volatility Expansion (BB > KC)
        const volExpansion = symbols.filter(s =>
            s.bb_width != null && s.kc_width != null && s.bb_width > s.kc_width
        );
        console.log(`BB Width > KC Width (Vol Expansion): ${volExpansion.length} symbols`);
        if (volExpansion.length > 0) {
            console.log('  Samples:', volExpansion.slice(0, 5).map(s => `${s.symbol} (BB:${s.bb_width?.toFixed(4)}, KC:${s.kc_width?.toFixed(4)})`).join(', '));
        }
        console.log('');

        // 3. High RVOL (> 2.0)
        const highRVOL = symbols.filter(s => s.relative_volume > 2.0 || s.rvol > 2.0);
        console.log(`RVOL > 2.0: ${highRVOL.length} symbols`);
        if (highRVOL.length > 0) {
            console.log('  Samples:', highRVOL.slice(0, 5).map(s => `${s.symbol} (${(s.relative_volume || s.rvol)?.toFixed(2)}x)`).join(', '));
        }
        console.log('');

        // 4. Very High RVOL (> 2.5)
        const veryHighRVOL = symbols.filter(s => s.relative_volume > 2.5 || s.rvol > 2.5);
        console.log(`RVOL > 2.5: ${veryHighRVOL.length} symbols`);
        console.log('');

        // 5. Above ORB 30m High
        const aboveORB = symbols.filter(s =>
            s.orb_high_30m != null && s.price > s.orb_high_30m
        );
        console.log(`Price > ORB High 30m: ${aboveORB.length} symbols`);
        if (aboveORB.length > 0) {
            console.log('  Samples:', aboveORB.slice(0, 5).map(s => `${s.symbol} (Price:${s.price}, ORB:${s.orb_high_30m})`).join(', '));
        }
        console.log('');

        // 6. Positive Daily Change (> 0.5%)
        const posDaily = symbols.filter(s => {
            const pct = s.pct_24h || s.daily_pct || s.percentage || 0;
            return pct > 0.5;
        });
        console.log(`Daily % > 0.5%: ${posDaily.length} symbols`);
        if (posDaily.length > 0) {
            console.log('  Samples:', posDaily.slice(0, 5).map(s => `${s.symbol} (${(s.pct_24h || s.daily_pct || s.percentage)?.toFixed(2)}%)`).join(', '));
        }
        console.log('');

        // === COMBINED CONDITIONS (Original Bullish Breakout) ===
        console.log('=== ORIGINAL BULLISH BREAKOUT CONDITIONS ===');
        console.log('Conditions: daily_pct > 0.5% AND price > orb_high_30m AND rvol > 2.5 AND bb > kc AND squeeze_off');

        const originalBreakout = symbols.filter(s => {
            const pct = s.pct_24h || s.daily_pct || s.percentage || 0;
            return pct > 0.5 &&
                s.price != null && s.orb_high_30m != null && s.price > s.orb_high_30m &&
                (s.relative_volume > 2.5 || s.rvol > 2.5) &&
                s.bb_width != null && s.kc_width != null && s.bb_width > s.kc_width &&
                s.squeeze_on === false;
        });

        console.log(`\nMatches: ${originalBreakout.length}`);
        if (originalBreakout.length > 0) {
            console.log('\nSymbols that met ALL conditions:');
            for (const s of originalBreakout) {
                console.log(`  ${s.symbol}: ${(s.pct_24h || s.daily_pct || s.percentage)?.toFixed(2)}%, RVOL: ${(s.relative_volume || s.rvol)?.toFixed(2)}x, Price: ${s.price}, ORB: ${s.orb_high_30m}`);
            }
        }
        console.log('');

        // === TTM SQUEEZE PURE (No Daily % requirement) ===
        console.log('=== TTM SQUEEZE PURE (No daily % filter) ===');
        console.log('Conditions: price > orb_high_30m AND rvol > 2.0 AND bb > kc AND squeeze_off');

        const pureBreakout = symbols.filter(s => {
            return s.price != null && s.orb_high_30m != null && s.price > s.orb_high_30m &&
                (s.relative_volume > 2.0 || s.rvol > 2.0) &&
                s.bb_width != null && s.kc_width != null && s.bb_width > s.kc_width &&
                s.squeeze_on === false;
        });

        console.log(`\nMatches: ${pureBreakout.length}`);
        if (pureBreakout.length > 0) {
            console.log('\nSymbols:');
            for (const s of pureBreakout) {
                const pct = s.pct_24h || s.daily_pct || s.percentage || 0;
                console.log(`  ${s.symbol}: Daily ${pct?.toFixed(2)}%, RVOL: ${(s.relative_volume || s.rvol)?.toFixed(2)}x`);
            }
        }
        console.log('');

        // === RELAXED CONDITIONS ===
        console.log('=== RELAXED (Just Squeeze OFF + Vol Expansion) ===');
        const relaxed = symbols.filter(s =>
            s.bb_width != null && s.kc_width != null && s.bb_width > s.kc_width &&
            s.squeeze_on === false
        );
        console.log(`Matches: ${relaxed.length}`);
        if (relaxed.length > 0 && relaxed.length <= 20) {
            console.log('Symbols:', relaxed.map(s => s.symbol).join(', '));
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

main();

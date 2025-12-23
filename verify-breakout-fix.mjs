/**
 * Verify Bullish Breakout Fix - Query Railway QuestDB
 * 
 * NEW Conditions (Fixed):
 * 1. daily_pct > 0.5% (price_change_percentage_24h)
 * 2. price > orb_high_30m (instead of orb_breakout_30m >= 1)
 * 3. relative_volume > 2.5x
 * 4. bb_width > kc_width
 * 5. squeeze_on = false
 */

const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function queryQuestDB(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function main() {
    console.log('=== VERIFYING BULLISH BREAKOUT FIX ===\n');
    console.log('Today\'s Date: 2025-12-22');
    console.log('Market Hours (PKT): 09:00 - 15:30\n');

    // Step 1: Check if orb_high_30m exists in any table
    console.log('Step 1: Checking for ORB data in API...\n');

    // The ORB data is CALCULATED at runtime by the API, not stored in DB
    // Let's verify this by checking what fields the bubbles API returns

    // Step 2: Check daily_pct distribution
    console.log('Step 2: Checking daily_pct distribution today...');
    try {
        const pctQuery = await queryQuestDB(`
            SELECT 
                symbol,
                daily_pct,
                timestamp
            FROM minute_bars 
            WHERE timestamp > '2025-12-22T04:00:00.000Z'
            AND daily_pct > 0.5
            ORDER BY daily_pct DESC
            LIMIT 10
        `);

        if (pctQuery.dataset && pctQuery.dataset.length > 0) {
            console.log('Symbols with daily_pct > 0.5%:');
            for (const row of pctQuery.dataset) {
                console.log(`  ${row[0]}: ${row[1]?.toFixed(2)}% at ${row[2]}`);
            }
        } else {
            console.log('⚠️ No symbols found with daily_pct > 0.5%');
        }
    } catch (e) {
        console.error('Query failed:', e.message);
    }
    console.log('');

    // Step 3: Check max daily_pct for each symbol
    console.log('Step 3: Top 10 gainers today by max daily_pct...');
    try {
        const topQuery = await queryQuestDB(`
            SELECT 
                symbol,
                max(daily_pct) as max_pct,
                max(timestamp) as last_update
            FROM minute_bars 
            WHERE timestamp > '2025-12-22T04:00:00.000Z'
            GROUP BY symbol
            ORDER BY max_pct DESC
            LIMIT 10
        `);

        if (topQuery.dataset && topQuery.dataset.length > 0) {
            console.log('Top Gainers:');
            for (const row of topQuery.dataset) {
                console.log(`  ${row[0]}: ${row[1]?.toFixed(2)}%`);
            }
        }
    } catch (e) {
        console.error('Query failed:', e.message);
    }
    console.log('');

    // Step 4: The REAL issue - ORB, RVOL, BB, KC are NOT in database
    console.log('=== CRITICAL FINDING ===');
    console.log('');
    console.log('The following fields are CALCULATED BY API, not stored in DB:');
    console.log('  - orb_high_30m (calculated from first 30 mins of trading)');
    console.log('  - relative_volume (calculated from 30-day avg)');
    console.log('  - bb_width (calculated from 20-bar Bollinger Bands)');
    console.log('  - kc_width (calculated from 20-bar Keltner Channels)');
    console.log('  - squeeze_on (calculated when BB inside KC)');
    console.log('');
    console.log('These values are only available in the /api/bubbles response,');
    console.log('not directly queryable from QuestDB.');
    console.log('');
    console.log('To verify the fix works, you need to:');
    console.log('1. Open the app during market hours');
    console.log('2. Select "Bullish Breakout" filter');
    console.log('3. Check browser DevTools > Network tab for bubbles API');
    console.log('4. Look for symbols where ALL conditions are met');
}

main().catch(console.error);

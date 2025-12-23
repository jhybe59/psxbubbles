/**
 * Query Railway QuestDB to check Bullish Breakout conditions
 * 
 * Conditions:
 * 1. price_change_percentage_24h > 0.5%
 * 2. orb_breakout_30m >= 1 (above ORB 30m high)
 * 3. relative_volume > 2.5x
 * 4. bb_width > kc_width (volatility expansion)
 * 5. squeeze_on = false
 */

const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function queryQuestDB(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function main() {
    console.log('=== Checking Bullish Breakout Conditions ===\n');

    // First, check available columns in minute_bars
    console.log('1. Checking table schema...');
    try {
        const schema = await queryQuestDB("SELECT * FROM minute_bars LIMIT 1");
        console.log('Available columns:', schema.columns?.map(c => c.name).join(', '));
        console.log('');
    } catch (e) {
        console.error('Schema check failed:', e.message);
    }

    // Check today's data range
    console.log('2. Checking data timestamp range...');
    try {
        const range = await queryQuestDB("SELECT min(timestamp) as earliest, max(timestamp) as latest, count(*) as total FROM minute_bars WHERE timestamp > dateadd('h', -12, now())");
        if (range.dataset && range.dataset[0]) {
            console.log('Earliest:', range.dataset[0][0]);
            console.log('Latest:', range.dataset[0][1]);
            console.log('Total rows:', range.dataset[0][2]);
        }
        console.log('');
    } catch (e) {
        console.error('Range check failed:', e.message);
    }

    // Check each condition individually
    console.log('3. Checking individual conditions...\n');

    // Condition 1: daily_pct > 0.5%
    console.log('Condition 1: daily_pct > 0.5%');
    try {
        const q1 = await queryQuestDB(`
            SELECT symbol, timestamp, daily_pct 
            FROM minute_bars 
            WHERE timestamp > dateadd('h', -12, now()) 
            AND daily_pct > 0.5 
            ORDER BY timestamp DESC 
            LIMIT 5
        `);
        console.log('Matches:', q1.dataset?.length || 0);
        if (q1.dataset?.length > 0) {
            console.log('Sample:', q1.dataset.slice(0, 3));
        }
    } catch (e) {
        console.error('Query failed:', e.message);
    }
    console.log('');

    // Condition 2: orb_breakout_30m >= 1
    console.log('Condition 2: orb_breakout_30m >= 1 (above ORB high)');
    try {
        const q2 = await queryQuestDB(`
            SELECT symbol, timestamp, orb_breakout_30m 
            FROM minute_bars 
            WHERE timestamp > dateadd('h', -12, now()) 
            AND orb_breakout_30m >= 1 
            ORDER BY timestamp DESC 
            LIMIT 5
        `);
        console.log('Matches:', q2.dataset?.length || 0);
        if (q2.dataset?.length > 0) {
            console.log('Sample:', q2.dataset.slice(0, 3));
        }
    } catch (e) {
        console.error('Query failed:', e.message);
    }
    console.log('');

    // Condition 3: relative_volume > 2.5
    console.log('Condition 3: relative_volume > 2.5');
    try {
        const q3 = await queryQuestDB(`
            SELECT symbol, timestamp, relative_volume 
            FROM minute_bars 
            WHERE timestamp > dateadd('h', -12, now()) 
            AND relative_volume > 2.5 
            ORDER BY timestamp DESC 
            LIMIT 5
        `);
        console.log('Matches:', q3.dataset?.length || 0);
        if (q3.dataset?.length > 0) {
            console.log('Sample:', q3.dataset.slice(0, 3));
        }
    } catch (e) {
        console.error('Query failed:', e.message);
    }
    console.log('');

    // Condition 4: bb_width > kc_width
    console.log('Condition 4: bb_width > kc_width (volatility expansion)');
    try {
        const q4 = await queryQuestDB(`
            SELECT symbol, timestamp, bb_width, kc_width 
            FROM minute_bars 
            WHERE timestamp > dateadd('h', -12, now()) 
            AND bb_width > kc_width 
            ORDER BY timestamp DESC 
            LIMIT 5
        `);
        console.log('Matches:', q4.dataset?.length || 0);
        if (q4.dataset?.length > 0) {
            console.log('Sample:', q4.dataset.slice(0, 3));
        }
    } catch (e) {
        console.error('Query failed:', e.message);
    }
    console.log('');

    // Condition 5: squeeze_on = false
    console.log('Condition 5: squeeze_on = false');
    try {
        const q5 = await queryQuestDB(`
            SELECT symbol, timestamp, squeeze_on 
            FROM minute_bars 
            WHERE timestamp > dateadd('h', -12, now()) 
            AND squeeze_on = false 
            ORDER BY timestamp DESC 
            LIMIT 5
        `);
        console.log('Matches:', q5.dataset?.length || 0);
        if (q5.dataset?.length > 0) {
            console.log('Sample:', q5.dataset.slice(0, 3));
        }
    } catch (e) {
        console.error('Query failed:', e.message);
    }
    console.log('');

    // ALL CONDITIONS COMBINED
    console.log('=== ALL 5 CONDITIONS COMBINED ===');
    try {
        const allConditions = await queryQuestDB(`
            SELECT symbol, timestamp, daily_pct, orb_breakout_30m, relative_volume, bb_width, kc_width, squeeze_on 
            FROM minute_bars 
            WHERE timestamp > dateadd('h', -12, now()) 
            AND daily_pct > 0.5 
            AND orb_breakout_30m >= 1 
            AND relative_volume > 2.5 
            AND bb_width > kc_width 
            AND squeeze_on = false 
            ORDER BY timestamp DESC 
            LIMIT 20
        `);
        console.log('Total matches where ALL conditions met:', allConditions.dataset?.length || 0);
        if (allConditions.dataset?.length > 0) {
            console.log('\nSymbols that met ALL Bullish Breakout conditions:');
            for (const row of allConditions.dataset) {
                console.log(`  ${row[0]} at ${row[1]} - daily_pct: ${row[2]?.toFixed(2)}%, RVOL: ${row[4]?.toFixed(2)}x`);
            }
        } else {
            console.log('\n⚠️ NO symbols met ALL 5 conditions in the last 12 hours!');
        }
    } catch (e) {
        console.error('Combined query failed:', e.message);
    }
}

main().catch(console.error);

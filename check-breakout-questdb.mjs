/**
 * Query Railway QuestDB directly to check breakout conditions
 * Note: Most breakout metrics are calculated at API level, not stored in DB
 */

const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function queryQuestDB(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function main() {
    console.log('=== CHECKING QUESTDB FOR BREAKOUT DATA ===\n');

    // Step 1: Get all table names
    console.log('Step 1: Available tables...');
    try {
        const tables = await queryQuestDB("SHOW TABLES");
        console.log('Tables:', tables.dataset?.map(t => t[0]).join(', '));
    } catch (e) {
        console.error('Error:', e.message);
    }
    console.log('');

    // Step 2: Check minute_bars schema
    console.log('Step 2: minute_bars columns...');
    try {
        const schema = await queryQuestDB("SELECT * FROM minute_bars LIMIT 1");
        console.log('Columns:', schema.columns?.map(c => c.name).join(', '));
    } catch (e) {
        console.error('Error:', e.message);
    }
    console.log('');

    // Step 3: Check trades schema
    console.log('Step 3: trades columns...');
    try {
        const schema = await queryQuestDB("SELECT * FROM trades LIMIT 1");
        console.log('Columns:', schema.columns?.map(c => c.name).join(', '));
    } catch (e) {
        console.error('Error:', e.message);
    }
    console.log('');

    // Step 4: Check for any ORB data table
    console.log('Step 4: Looking for ORB data...');
    try {
        const orb = await queryQuestDB("SELECT * FROM orb_levels LIMIT 1");
        console.log('ORB levels columns:', orb.columns?.map(c => c.name).join(', '));
    } catch (e) {
        console.log('orb_levels table not found');
    }
    console.log('');

    // Step 5: Check data from last trading day (Friday Dec 20)
    console.log('Step 5: Data from last trading session...');
    try {
        const recent = await queryQuestDB(`
            SELECT 
                symbol, 
                min(timestamp) as first_ts,
                max(timestamp) as last_ts,
                count(*) as bar_count,
                min(low) as day_low,
                max(high) as day_high,
                first(open) as day_open,
                last(close) as day_close
            FROM minute_bars 
            WHERE timestamp > '2025-12-22T04:00:00.000Z'
            GROUP BY symbol
            ORDER BY bar_count DESC
            LIMIT 10
        `);

        if (recent.dataset?.length > 0) {
            console.log('\nTop 10 symbols by bar count:');
            console.log('Symbol | Bars | Open | High | Low | Close | Change%');
            for (const row of recent.dataset) {
                const [symbol, first_ts, last_ts, bars, low, high, open, close] = row;
                const changePct = open > 0 ? ((close - open) / open * 100).toFixed(2) : '0';
                console.log(`${symbol} | ${bars} | ${open?.toFixed(2)} | ${high?.toFixed(2)} | ${low?.toFixed(2)} | ${close?.toFixed(2)} | ${changePct}%`);
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
    console.log('');

    // Step 6: Calculate which symbols had biggest moves (potential breakouts)
    console.log('Step 6: Biggest movers (potential breakouts)...');
    try {
        const movers = await queryQuestDB(`
            SELECT 
                symbol,
                first(open) as day_open,
                max(high) as day_high,
                min(low) as day_low,
                last(close) as day_close,
                sum(volume) as total_volume,
                count(*) as bars
            FROM minute_bars 
            WHERE timestamp > '2025-12-22T04:00:00.000Z'
            GROUP BY symbol
            ORDER BY ((last(close) - first(open)) / first(open) * 100) DESC
            LIMIT 15
        `);

        if (movers.dataset?.length > 0) {
            console.log('\nTop Gainers:');
            for (const row of movers.dataset) {
                const [symbol, open, high, low, close, volume, bars] = row;
                if (open && open > 0) {
                    const changePct = ((close - open) / open * 100).toFixed(2);
                    const range = ((high - low) / low * 100).toFixed(2);
                    if (parseFloat(changePct) > 0) {
                        console.log(`  ${symbol}: ${changePct}% (Range: ${range}%, Vol: ${volume?.toLocaleString()})`);
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
    console.log('');

    // Step 7: High volume spikes (RVOL proxy)
    console.log('Step 7: Volume analysis for breakout detection...');
    console.log('');
    console.log('=== IMPORTANT ===');
    console.log('QuestDB does NOT store:');
    console.log('  - squeeze_on, bb_width, kc_width (volatility metrics)');
    console.log('  - orb_high_30m (ORB levels)');
    console.log('  - relative_volume (RVOL calculation)');
    console.log('');
    console.log('These are calculated LIVE by the API from raw price/volume data.');
    console.log('To verify if breakout conditions were met, need to:');
    console.log('  1. Add logging to bubbles API to track when conditions are met');
    console.log('  2. Store breakout events in a separate QuestDB table');
}

main().catch(console.error);

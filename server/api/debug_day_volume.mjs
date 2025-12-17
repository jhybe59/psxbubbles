/**
 * Debug script to check trades data for today's session
 * Run with: node server/api/debug_day_volume.mjs
 */
import { queryQuestDB } from './questdb.mjs';

async function run() {
    console.log('--- DAY VOLUME DEBUG ---');
    console.log('Current time (local):', new Date().toLocaleString());

    // Check server time
    const timeCheck = await queryQuestDB(`SELECT now()`);
    console.log('DB Server time (UTC):', timeCheck?.dataset?.[0]?.[0]);

    // Calculate session start
    const sessionStartSql = `SELECT dateadd('h', 4, date_trunc('day', now()))`;
    const sessionStart = await queryQuestDB(sessionStartSql);
    console.log('Session start time:', sessionStart?.dataset?.[0]?.[0]);

    // Count trades in trades table
    const countSql = `SELECT count(*) FROM trades`;
    const totalCount = await queryQuestDB(countSql);
    console.log('Total trades in table:', totalCount?.dataset?.[0]?.[0]);

    // Count trades since session start
    const todayCountSql = `
        SELECT count(*) 
        FROM trades 
        WHERE timestamp >= dateadd('h', 4, date_trunc('day', now()))
    `;
    const todayCount = await queryQuestDB(todayCountSql);
    console.log('Trades since session start:', todayCount?.dataset?.[0]?.[0]);

    // Get sample trades from today
    console.log('\\n--- SAMPLE TRADES FROM TODAY ---');
    const sampleSql = `
        SELECT symbol, timestamp, price, volume 
        FROM trades 
        WHERE timestamp >= dateadd('h', 4, date_trunc('day', now()))
        ORDER BY timestamp DESC
        LIMIT 10
    `;
    const sample = await queryQuestDB(sampleSql);
    if (sample?.dataset?.length > 0) {
        console.table(sample.dataset.map(r => ({
            symbol: r[0],
            timestamp: r[1],
            price: r[2],
            volume: r[3]
        })));
    } else {
        console.log('NO TRADES FOUND FOR TODAY SESSION!');

        // Check last trades in table
        console.log('\\n--- MOST RECENT TRADES (any time) ---');
        const recentSql = `
            SELECT symbol, timestamp, price, volume 
            FROM trades 
            ORDER BY timestamp DESC
            LIMIT 10
        `;
        const recent = await queryQuestDB(recentSql);
        if (recent?.dataset?.length > 0) {
            console.table(recent.dataset.map(r => ({
                symbol: r[0],
                timestamp: r[1],
                price: r[2],
                volume: r[3]
            })));
        } else {
            console.log('TRADES TABLE IS EMPTY!');
        }
    }

    // Test the day_vols query directly
    console.log('\\n--- DAY VOLUME QUERY TEST ---');
    const dayVolSql = `
        SELECT symbol, sum(volume) as day_volume
        FROM trades
        WHERE timestamp >= dateadd('h', 4, date_trunc('day', now()))
        GROUP BY symbol
        LIMIT 10
    `;
    const dayVol = await queryQuestDB(dayVolSql);
    if (dayVol?.dataset?.length > 0) {
        console.log('Day volumes found:');
        console.table(dayVol.dataset.map(r => ({
            symbol: r[0],
            day_volume: r[1]
        })));
    } else {
        console.log('NO DAY VOLUMES - Query returned nothing!');
    }
}

run().catch(console.error);

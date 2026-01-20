/**
 * Replay Day Data Script
 * 
 * Fetches today's trades from QuestDB and streams them through the 
 * real-time publishing pipeline to test Socket.IO visuals.
 */

import { queryQuestDB } from '../server/api/questdb.mjs';
import { initPublisher, publishTickUpdate } from '../workers/ingestion/realtime-publisher.mjs';
import logger from '../workers/ingestion/logger.mjs';

// Configuration
const SPEED_MULTIPLIER = 10; // 10x speed
const MAX_GAP_MS = 2000; // Max sleep between trades (2 seconds)
const TIME_WINDOW_HOURS = 12; // Replay last 12 hours of data

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runReplay() {
    console.log('🚀 Starting Data Replay...');

    // 1. Initialize Publisher (Redis connection, etc.)
    const initialized = await initPublisher();
    if (!initialized) {
        console.error('❌ Failed to initialize publisher. Is Redis running?');
        process.exit(1);
    }

    // 2. Fetch today's trades
    console.log(`🔍 Fetching trades from the last ${TIME_WINDOW_HOURS} hours...`);
    const sql = `
        SELECT symbol, timestamp as ts, price, volume 
        FROM trades 
        WHERE timestamp > dateadd('h', -${TIME_WINDOW_HOURS}, now()) 
        ORDER BY timestamp ASC
    `;

    try {
        const result = await queryQuestDB(sql);
        const trades = result.dataset;

        if (!trades || trades.length === 0) {
            console.log('⚠️ No trades found in the specified window.');
            console.log('Tip: Ensure the "trades" table has data for today.');
            process.exit(0);
        }

        console.log(`✅ Loaded ${trades.length} trades. Starting stream at ${SPEED_MULTIPLIER}x speed...`);

        let lastTs = null;
        let count = 0;

        for (const row of trades) {
            const [symbol, tsStr, price, volume] = row;
            const ts = new Date(tsStr).getTime();

            // Calculate delay based on timestamp gap
            if (lastTs) {
                const gap = ts - lastTs;
                if (gap > 0) {
                    const delay = Math.min(gap / SPEED_MULTIPLIER, MAX_GAP_MS);
                    if (delay > 10) { // Only sleep if it's significant
                        await sleep(delay);
                    }
                }
            }

            // Publish to pipeline
            await publishTickUpdate(symbol, {
                symbol,
                price: Number(price),
                volume: Number(volume),
                ts: ts
            });

            lastTs = ts;
            count++;

            if (count % 100 === 0) {
                process.stdout.write(`\r📡 Replayed ${count}/${trades.length} ticks...`);
            }
        }

        console.log('\n\n✅ Replay complete!');
        process.exit(0);

    } catch (err) {
        console.error('❌ Replay error:', err);
        process.exit(1);
    }
}

runReplay();

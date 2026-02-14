import { Sender } from '@questdb/nodejs-client';
import { config } from './config.mjs';
import logger from './logger.mjs';

let sender = null;
let isInitialized = false;

// In-memory tick sequence counters per symbol
// Tracks how many ticks have been received for each symbol since worker start
const tickCounters = new Map();

/**
 * Get the next tick sequence number for a symbol
 * @param {string} symbol - The trading symbol
 * @returns {number} The next tick sequence number
 */
export const getNextTickSeq = (symbol) => {
    const current = tickCounters.get(symbol) || 0;
    const next = current + 1;
    tickCounters.set(symbol, next);
    return next;
};

/**
 * Reset tick counter for a symbol (useful for testing)
 * @param {string} symbol - The trading symbol, or null to reset all
 */
export const resetTickCounter = (symbol = null) => {
    if (symbol) {
        tickCounters.delete(symbol);
    } else {
        tickCounters.clear();
    }
};

/**
 * Initialize QuestDB ILP sender with retry logic
 */
export const initQuestDB = async () => {
    if (isInitialized) return;
    isInitialized = true;

    const host = config.questdb?.host || 'localhost';
    const httpPort = config.questdb?.httpPort || 9000;
    const maxRetries = 5;
    let retryCount = 0;

    while (retryCount < maxRetries) {
        try {
            // Create sender with HTTP protocol configuration
            // Added request_timeout (30s), auto_flush_rows (100), and retry_timeout (10s) to prevent timeouts
            sender = await Sender.fromConfig(
                `http::addr=${host}:${httpPort};request_timeout=30000;retry_timeout=10000;auto_flush_rows=100;auto_flush_interval=1000;`
            );
            logger.info({ host, httpPort }, 'QuestDB ILP sender initialized with extended timeouts');
            return;
        } catch (err) {
            retryCount++;
            logger.warn({
                err: err.message || String(err),
                retry: retryCount,
                maxRetries
            }, 'QuestDB sender init failed, retrying...');

            if (retryCount < maxRetries) {
                // Wait before retry (exponential backoff)
                await new Promise(r => setTimeout(r, 2000 * retryCount));
            }
        }
    }

    logger.error({ host, httpPort }, 'QuestDB sender init failed after all retries');
    sender = null;
};

/**
 * Insert minute bars into QuestDB using ILP (high-speed ingestion)
 * @param {Array} rows - Array of normalized bar data
 */
export const insertMinuteBarsQuest = async (rows) => {
    if (!sender) {
        // Silently skip if sender not available (non-fatal)
        return 0;
    }

    if (!rows || rows.length === 0) return 0;

    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        try {
            for (const row of rows) {
                // Convert timestamp to nanoseconds for QuestDB
                const tsMs = Number(row.ts);
                const tsNanos = BigInt(tsMs) * 1000000n;

                // Get next tick sequence for this symbol
                const tickSeq = getNextTickSeq(String(row.symbol));

                // 1. Write to 'trades' (New Scheme - pure ticks)
                sender
                    .table('trades')
                    .symbol('symbol', String(row.symbol))
                    .floatColumn('price', parseFloat(row.close) || 0)
                    .floatColumn('volume', parseFloat(row.volume) || 0)
                    .floatColumn('value', parseFloat(row.value) || 0)
                    .floatColumn('daily_pct', parseFloat(row.daily_pct) || 0)
                    .intColumn('tick_seq', tickSeq)
                    .at(tsNanos, 'ns');

                // 2. Write to 'minute_bars' (OHLCV for ML training)
                sender
                    .table('minute_bars')
                    .symbol('symbol', String(row.symbol))
                    .floatColumn('open', parseFloat(row.open) || parseFloat(row.close) || 0)
                    .floatColumn('high', parseFloat(row.high) || parseFloat(row.close) || 0)
                    .floatColumn('low', parseFloat(row.low) || parseFloat(row.close) || 0)
                    .floatColumn('close', parseFloat(row.close) || 0)
                    .floatColumn('volume', parseFloat(row.volume) || 0)
                    .floatColumn('value', parseFloat(row.value) || 0)
                    .floatColumn('daily_pct', parseFloat(row.daily_pct) || 0)
                    .intColumn('trades', 1)
                    .at(tsNanos, 'ns');
            }

            await sender.flush();
            return rows.length;
        } catch (err) {
            attempt++;
            if (attempt < MAX_RETRIES) {
                // Exponential backoff: 500ms, 1000ms, 2000ms
                const backoffMs = 500 * Math.pow(2, attempt - 1);
                logger.warn({
                    err: err.message,
                    count: rows.length,
                    attempt,
                    maxRetries: MAX_RETRIES,
                    backoffMs
                }, `QuestDB insert failed, retrying in ${backoffMs}ms...`);
                await new Promise(r => setTimeout(r, backoffMs));
            } else {
                logger.warn({ err: err.message, count: rows.length }, 'QuestDB insert failed after all retries (non-fatal)');
                return 0;
            }
        }
    }

    return 0;
};

/**
 * Close QuestDB sender connection
 */
export const closeQuestDB = async () => {
    if (sender) {
        try {
            await sender.close();
            logger.info('QuestDB sender closed');
        } catch (err) {
            logger.warn({ err: err.message }, 'Error closing QuestDB sender');
        }
        sender = null;
    }
    isInitialized = false;
};

export default {
    initQuestDB,
    insertMinuteBarsQuest,
    closeQuestDB,
    getNextTickSeq,
    resetTickCounter
};

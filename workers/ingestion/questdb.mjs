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
            sender = await Sender.fromConfig(`http::addr=${host}:${httpPort};`);
            logger.info({ host, httpPort }, 'QuestDB ILP sender initialized');
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

            // 2. Write to 'minute_bars' (Legacy Scheme - DEPRECATED)
            // COMMENTED OUT to save RAM (Duplicate data)
            /*
            sender
                .table('minute_bars')
                .symbol('symbol', String(row.symbol))
                .floatColumn('open', parseFloat(row.open) || 0)
                .floatColumn('high', parseFloat(row.high) || 0)
                .floatColumn('low', parseFloat(row.low) || 0)
                .floatColumn('close', parseFloat(row.close) || 0)
                .floatColumn('volume', parseFloat(row.volume) || 0)
                .floatColumn('value', parseFloat(row.value) || 0)
                .floatColumn('daily_pct', parseFloat(row.daily_pct) || 0)
                .intColumn('tick_seq', tickSeq)
                .at(tsNanos, 'ns');
            */
        }

        await sender.flush();
        return rows.length;
    } catch (err) {
        logger.warn({ err: err.message, count: rows.length }, 'QuestDB insert failed (non-fatal)');
        return 0;
    }
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

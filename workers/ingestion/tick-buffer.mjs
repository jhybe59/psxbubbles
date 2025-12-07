/**
 * Tick Buffer Manager (Rolling History)
 * Keeps rolling history of ticks per symbol.
 * When user requests N ticks, immediately returns OHLCV from LAST N ticks.
 * 
 * Usage:
 *   import { addTick, getLastNTicksOHLCV, TICK_INTERVALS } from './tick-buffer.mjs';
 *   
 *   // On each tick from WebSocket:
 *   addTick({ symbol: 'LUCK', price: 100.5, volume: 1000, ts: Date.now() });
 *   
 *   // When user clicks "100 Ticks":
 *   const bubbles = getAllSymbolsOHLCV(100);
 *   // Returns OHLCV for ALL symbols using their last 100 ticks
 */

import logger from './logger.mjs';

// Supported tick intervals
export const TICK_INTERVALS = [10, 100, 500, 1000];

// Maximum ticks to keep per symbol (enough for largest interval + buffer)
const MAX_HISTORY_SIZE = 1500;

// In-memory tick history per symbol
// Map<symbol, Array<{price, volume, ts}>>
const tickHistory = new Map();

/**
 * Add a tick to the rolling history
 * @param {Object} tick - { symbol, price, volume, ts }
 */
export function addTick(tick) {
    if (!tick || !tick.symbol || tick.price == null) return;

    const { symbol, price, volume = 0, ts = Date.now() } = tick;

    if (!tickHistory.has(symbol)) {
        tickHistory.set(symbol, []);
    }

    const history = tickHistory.get(symbol);
    history.push({ price, volume, ts });

    // Trim to max size (keep most recent)
    if (history.length > MAX_HISTORY_SIZE) {
        history.splice(0, history.length - MAX_HISTORY_SIZE);
    }
}

/**
 * Calculate OHLCV from an array of ticks
 * @param {Array} ticks - Array of { price, volume, ts }
 * @returns {Object} OHLCV data
 */
function calculateOHLCV(ticks) {
    if (!ticks || ticks.length === 0) return null;

    const prices = ticks.map(t => t.price);
    const open = prices[0];
    const close = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const volume = ticks.reduce((sum, t) => sum + (t.volume || 0), 0);
    const pctChange = open !== 0 ? ((close - open) / open) * 100 : 0;
    const startTs = ticks[0].ts;
    const endTs = ticks[ticks.length - 1].ts;
    const timeElapsedMs = endTs - startTs;

    return {
        open,
        high,
        low,
        close,
        volume,
        pctChange,
        startTs,
        endTs,
        timeElapsedMs,
        tickCount: ticks.length
    };
}

/**
 * Get OHLCV for a specific symbol using last N ticks
 * @param {string} symbol - Symbol name
 * @param {number} n - Number of ticks to use
 * @returns {Object|null} OHLCV data or null if not enough ticks
 */
export function getLastNTicksOHLCV(symbol, n) {
    const history = tickHistory.get(symbol);
    if (!history || history.length === 0) return null;

    // Take last N ticks (or all if less than N)
    const ticks = history.slice(-n);
    if (ticks.length === 0) return null;

    const ohlcv = calculateOHLCV(ticks);
    if (!ohlcv) return null;

    return {
        symbol,
        ...ohlcv,
        interval: n,
        hasEnoughTicks: ticks.length >= n
    };
}

/**
 * Get OHLCV for ALL symbols using last N ticks
 * This is called when user clicks on a tick interval button
 * @param {number} n - Number of ticks (10, 100, 500, 1000)
 * @returns {Array} Array of bubble data for all symbols
 */
export function getAllSymbolsOHLCV(n) {
    const bubbles = [];

    for (const [symbol, history] of tickHistory.entries()) {
        if (history.length === 0) continue;

        // Take last N ticks
        const ticks = history.slice(-n);
        const ohlcv = calculateOHLCV(ticks);

        if (ohlcv) {
            bubbles.push({
                symbol,
                ...ohlcv,
                interval: n,
                hasEnoughTicks: ticks.length >= n,
                availableTicks: ticks.length
            });
        }
    }

    return bubbles;
}

/**
 * Get tick count for a symbol
 * @param {string} symbol - Symbol name
 * @returns {number} Number of ticks in history
 */
export function getTickCount(symbol) {
    const history = tickHistory.get(symbol);
    return history ? history.length : 0;
}

/**
 * Get buffer status for debugging
 */
export function getBufferStatus() {
    const status = {};

    for (const [symbol, history] of tickHistory.entries()) {
        status[symbol] = {
            tickCount: history.length,
            oldestTs: history.length > 0 ? history[0].ts : null,
            newestTs: history.length > 0 ? history[history.length - 1].ts : null
        };
    }

    return status;
}

/**
 * Clear all buffers (useful for testing or reset)
 */
export function clearBuffers() {
    tickHistory.clear();
    logger.info('Tick buffers cleared');
}

export default {
    addTick,
    getLastNTicksOHLCV,
    getAllSymbolsOHLCV,
    getTickCount,
    getBufferStatus,
    clearBuffers,
    TICK_INTERVALS
};

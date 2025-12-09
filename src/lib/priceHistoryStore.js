/**
 * Price History Store
 * Maintains rolling price history (last 10 values) per symbol for sparkline tooltips.
 * Also tracks previous metric values for trend direction detection (▲▼═).
 * 
 * Usage:
 *   import { updatePrices, getHistory, getAllHistory, getTrend } from './priceHistoryStore';
 *   
 *   // On each data refresh:
 *   updatePrices(coins); // coins = [{symbol, price, ts}, ...]
 *   
 *   // When rendering tooltip:
 *   const { prices, lastUpdate } = getHistory('HUBC');
 *   
 *   // For trend indicators:
 *   const trend = getTrend('HUBC', 'price', currentPrice); // 'up', 'down', or 'same'
 */

const HISTORY_LENGTH = 10;

// Map<symbol, Map<metric, previousValue>> for trend detection
const previousValues = new Map();

// Map<symbol, { prices: number[], lastUpdate: string, volume: number, rvol: number, volatility: number }>
const priceHistory = new Map();

/**
 * Update price history for multiple symbols at once
 * @param {Array} coins - Array of coin data from useOHLCV
 */
export function updatePrices(coins) {
    if (!coins || !Array.isArray(coins)) return;

    const now = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    for (const coin of coins) {
        if (!coin || !coin.symbol || coin.price == null) continue;

        const symbol = coin.symbol.toUpperCase();
        let entry = priceHistory.get(symbol);

        if (!entry) {
            entry = { prices: [], lastUpdate: now, volume: 0, rvol: 1, volatility: 0 };
            priceHistory.set(symbol, entry);
        }

        // Only add if price changed (avoid duplicates for same price)
        const lastPrice = entry.prices.length > 0 ? entry.prices[entry.prices.length - 1] : null;
        if (lastPrice !== coin.price) {
            entry.prices.push(coin.price);
            // Trim to max size
            if (entry.prices.length > HISTORY_LENGTH) {
                entry.prices.shift();
            }
        }

        // Update metadata
        entry.lastUpdate = now;
        entry.volume = coin.volume || 0;
        entry.rvol = coin.relative_volume || 1;
        entry.volatility = coin.volatility || 0;
    }
}

/**
 * Get price history for a single symbol
 * @param {string} symbol - Symbol name
 * @returns {{ prices: number[], lastUpdate: string, volume: number, rvol: number, volatility: number } | null}
 */
export function getHistory(symbol) {
    if (!symbol) return null;
    return priceHistory.get(symbol.toUpperCase()) || null;
}

/**
 * Get all price histories
 * @returns {Map}
 */
export function getAllHistory() {
    return priceHistory;
}

/**
 * Clear all history (useful for testing)
 */
export function clearHistory() {
    priceHistory.clear();
}

/**
 * Get history count (for debugging)
 */
export function getHistoryCount() {
    return priceHistory.size;
}

/**
 * Store previous value for a metric (called before updating with new value)
 * @param {string} symbol - Symbol name
 * @param {string} metric - Metric name (price, pct, volume, volatility, rvol)
 * @param {number} value - Current value (will become previous on next call)
 */
export function storePreviousValue(symbol, metric, value) {
    if (!symbol || !metric || value == null) return;
    const sym = symbol.toUpperCase();
    if (!previousValues.has(sym)) {
        previousValues.set(sym, new Map());
    }
    previousValues.get(sym).set(metric, value);
}

/**
 * Get trend direction for a metric compared to its previous value
 * @param {string} symbol - Symbol name
 * @param {string} metric - Metric name
 * @param {number} currentValue - Current metric value
 * @returns {'up' | 'down' | 'same'} - Trend direction
 */
export function getTrend(symbol, metric, currentValue) {
    if (!symbol || !metric || currentValue == null) return 'same';
    const sym = symbol.toUpperCase();
    const symbolPrevious = previousValues.get(sym);
    if (!symbolPrevious) return 'same';

    const prevValue = symbolPrevious.get(metric);
    if (prevValue == null) return 'same';

    const diff = currentValue - prevValue;
    // Use small threshold to avoid floating point issues
    const threshold = Math.abs(prevValue) * 0.0001 || 0.0001;

    if (diff > threshold) return 'up';
    if (diff < -threshold) return 'down';
    return 'same';
}

/**
 * Update all previous values for a symbol (call this after each refresh)
 * @param {object} coin - Coin data with all metrics
 */
export function updatePreviousValues(coin) {
    if (!coin || !coin.symbol) return;
    const sym = coin.symbol.toUpperCase();

    // Store current values as previous for next comparison
    if (coin.price != null) storePreviousValue(sym, 'price', coin.price);
    if (coin.price_change_percentage_24h != null) storePreviousValue(sym, 'pct', coin.price_change_percentage_24h);
    if (coin.volume != null) storePreviousValue(sym, 'volume', coin.volume);
    if (coin.volatility != null) storePreviousValue(sym, 'volatility', coin.volatility);
    if (coin.relative_volume != null) storePreviousValue(sym, 'rvol', coin.relative_volume);
}

export default {
    updatePrices,
    getHistory,
    getAllHistory,
    clearHistory,
    getHistoryCount,
    getTrend,
    storePreviousValue,
    updatePreviousValues
};

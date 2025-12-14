/**
 * Heikin-Ashi Transformation Utility
 * Converts regular OHLC candles to Heikin-Ashi candles
 * 
 * Formula (from TradingView):
 * - HA Close = (Open + High + Low + Close) / 4
 * - HA Open = (Previous HA Open + Previous HA Close) / 2
 * - HA High = max(High, HA Open, HA Close)
 * - HA Low = min(Low, HA Open, HA Close)
 */

/**
 * Transform regular OHLC candles to Heikin-Ashi candles
 * @param {Array} candles - Array of {time, open, high, low, close, volume?, value?}
 * @returns {Array} - Heikin-Ashi transformed candles
 */
export function toHeikinAshi(candles) {
    if (!candles || candles.length === 0) return [];

    const ha = [];

    for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const prev = ha[i - 1];

        // HA Close = average of all four prices
        const haClose = (c.open + c.high + c.low + c.close) / 4;

        // HA Open = midpoint of previous HA candle body
        // For first candle, use regular open-close midpoint
        const haOpen = prev
            ? (prev.open + prev.close) / 2
            : (c.open + c.close) / 2;

        // HA High = highest of current high, HA open, HA close
        const haHigh = Math.max(c.high, haOpen, haClose);

        // HA Low = lowest of current low, HA open, HA close
        const haLow = Math.min(c.low, haOpen, haClose);

        ha.push({
            time: c.time,
            open: haOpen,
            high: haHigh,
            low: haLow,
            close: haClose,
            value: haClose, // For Area series compatibility
            volume: c.volume // Preserve volume
        });
    }

    return ha;
}

/**
 * Check if candle is bullish (HA style - based on body direction)
 * @param {Object} candle - Heikin-Ashi candle
 * @returns {boolean}
 */
export function isHABullish(candle) {
    return candle.close >= candle.open;
}

/**
 * Check if candle has no lower wick (strong uptrend signal)
 * @param {Object} candle - Heikin-Ashi candle
 * @returns {boolean}
 */
export function hasNoLowerWick(candle) {
    return Math.abs(candle.low - Math.min(candle.open, candle.close)) < 0.0001;
}

/**
 * Check if candle has no upper wick (strong downtrend signal)
 * @param {Object} candle - Heikin-Ashi candle
 * @returns {boolean}
 */
export function hasNoUpperWick(candle) {
    return Math.abs(candle.high - Math.max(candle.open, candle.close)) < 0.0001;
}

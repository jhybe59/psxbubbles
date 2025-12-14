/**
 * Indicator Calculation Functions
 * Pure mathematical functions for technical indicators
 */

/**
 * Simple Moving Average (SMA)
 * @param {number[]} data - Array of values (typically close prices)
 * @param {number} period - Number of periods
 * @returns {(number|null)[]} - SMA values (null for insufficient data)
 */
export function calculateSMA(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else {
            const slice = data.slice(i - period + 1, i + 1);
            const sum = slice.reduce((a, b) => a + b, 0);
            result.push(sum / period);
        }
    }
    return result;
}

/**
 * Exponential Moving Average (EMA)
 * @param {number[]} data - Array of values
 * @param {number} period - Number of periods
 * @returns {(number|null)[]} - EMA values
 */
export function calculateEMA(data, period) {
    const result = [];
    const multiplier = 2 / (period + 1);

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else if (i === period - 1) {
            // First EMA is SMA
            const slice = data.slice(0, period);
            const sma = slice.reduce((a, b) => a + b, 0) / period;
            result.push(sma);
        } else {
            const prevEMA = result[i - 1];
            const ema = (data[i] - prevEMA) * multiplier + prevEMA;
            result.push(ema);
        }
    }
    return result;
}

/**
 * Weighted Moving Average (WMA)
 * @param {number[]} data - Array of values
 * @param {number} period - Number of periods
 * @returns {(number|null)[]} - WMA values
 */
export function calculateWMA(data, period) {
    const result = [];
    const weights = [];
    let weightSum = 0;

    for (let i = 1; i <= period; i++) {
        weights.push(i);
        weightSum += i;
    }

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else {
            const slice = data.slice(i - period + 1, i + 1);
            let weighted = 0;
            for (let j = 0; j < period; j++) {
                weighted += slice[j] * weights[j];
            }
            result.push(weighted / weightSum);
        }
    }
    return result;
}

/**
 * Hull Moving Average (HMA)
 * HMA = WMA(2*WMA(n/2) − WMA(n)), sqrt(n))
 * @param {number[]} data - Array of values
 * @param {number} period - Number of periods
 * @returns {(number|null)[]} - HMA values
 */
export function calculateHMA(data, period) {
    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));

    const wmaHalf = calculateWMA(data, halfPeriod);
    const wmaFull = calculateWMA(data, period);

    // Calculate 2*WMA(n/2) - WMA(n)
    const rawHMA = [];
    for (let i = 0; i < data.length; i++) {
        if (wmaHalf[i] === null || wmaFull[i] === null) {
            rawHMA.push(null);
        } else {
            rawHMA.push(2 * wmaHalf[i] - wmaFull[i]);
        }
    }

    // Filter out nulls for final WMA calculation
    const validStart = rawHMA.findIndex(v => v !== null);
    if (validStart === -1) return rawHMA;

    const validData = rawHMA.slice(validStart).map(v => v ?? 0);
    const hmaValid = calculateWMA(validData, sqrtPeriod);

    // Reconstruct with nulls
    const result = new Array(validStart).fill(null);
    return result.concat(hmaValid);
}

/**
 * Volume Weighted Average Price (VWAP)
 * Cumulative (TP * Volume) / Cumulative Volume
 * @param {Object[]} candles - Array of {high, low, close, volume}
 * @returns {(number|null)[]} - VWAP values
 */
export function calculateVWAP(candles) {
    const result = [];
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    for (const candle of candles) {
        const tp = (candle.high + candle.low + candle.close) / 3;
        cumulativeTPV += tp * candle.volume;
        cumulativeVolume += candle.volume;

        if (cumulativeVolume === 0) {
            result.push(null);
        } else {
            result.push(cumulativeTPV / cumulativeVolume);
        }
    }
    return result;
}

/**
 * Bollinger Bands
 * @param {number[]} data - Array of close prices
 * @param {number} period - SMA period (default 20)
 * @param {number} stdDev - Standard deviation multiplier (default 2)
 * @returns {Object} - { upper, middle, lower } arrays
 */
export function calculateBollingerBands(data, period = 20, stdDev = 2) {
    const middle = calculateSMA(data, period);
    const upper = [];
    const lower = [];

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            upper.push(null);
            lower.push(null);
        } else {
            const slice = data.slice(i - period + 1, i + 1);
            const mean = middle[i];
            const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
            const std = Math.sqrt(variance);
            upper.push(mean + stdDev * std);
            lower.push(mean - stdDev * std);
        }
    }

    return { upper, middle, lower };
}

/**
 * Relative Strength Index (RSI)
 * @param {number[]} data - Array of close prices
 * @param {number} period - RSI period (default 14)
 * @returns {(number|null)[]} - RSI values (0-100)
 */
export function calculateRSI(data, period = 14) {
    const result = [];
    const gains = [];
    const losses = [];

    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? -change : 0);
    }

    result.push(null); // First value has no change

    for (let i = 0; i < gains.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else if (i === period - 1) {
            // First RSI uses simple average
            const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
            const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
            if (avgLoss === 0) {
                result.push(100);
            } else {
                const rs = avgGain / avgLoss;
                result.push(100 - (100 / (1 + rs)));
            }
        } else {
            // Subsequent RSI uses smoothed average
            const prevRSI = result[result.length - 1];
            if (prevRSI === null) {
                result.push(null);
                continue;
            }
            // Approximate previous avg gain/loss from RSI
            // This is a simplification - proper implementation would track running averages
            const avgGain = (gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)) / period;
            const avgLoss = (losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)) / period;
            if (avgLoss === 0) {
                result.push(100);
            } else {
                const rs = avgGain / avgLoss;
                result.push(100 - (100 / (1 + rs)));
            }
        }
    }

    return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 * @param {number[]} data - Array of close prices
 * @param {number} fastPeriod - Fast EMA period (default 12)
 * @param {number} slowPeriod - Slow EMA period (default 26)
 * @param {number} signalPeriod - Signal line period (default 9)
 * @returns {Object} - { macd, signal, histogram } arrays
 */
export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = calculateEMA(data, fastPeriod);
    const slowEMA = calculateEMA(data, slowPeriod);

    const macd = [];
    for (let i = 0; i < data.length; i++) {
        if (fastEMA[i] === null || slowEMA[i] === null) {
            macd.push(null);
        } else {
            macd.push(fastEMA[i] - slowEMA[i]);
        }
    }

    // Calculate signal line (EMA of MACD)
    const validStart = macd.findIndex(v => v !== null);
    const validMACD = macd.slice(validStart).map(v => v ?? 0);
    const signalValid = calculateEMA(validMACD, signalPeriod);
    const signal = new Array(validStart).fill(null).concat(signalValid);

    // Calculate histogram
    const histogram = [];
    for (let i = 0; i < data.length; i++) {
        if (macd[i] === null || signal[i] === null) {
            histogram.push(null);
        } else {
            histogram.push(macd[i] - signal[i]);
        }
    }

    return { macd, signal, histogram };
}

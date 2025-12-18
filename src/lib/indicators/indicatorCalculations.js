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

/**
 * Opening Range Breakout (ORB)
 * Calculates the High/Low ranges for the first X minutes of the day.
 * @param {Object[]} candles - Array of OHLCV candles
 * @param {number[]} periods - Array of periods in minutes (e.g., [5, 15, 30])
 * @returns {Object} - Object containing arrays for each period's high/low
 */
export function calculateORB(candles, periods = [5, 15, 30]) {
    // Result containers
    const results = {};
    periods.forEach(p => {
        results[`up${p}`] = new Array(candles.length).fill(null);
        results[`down${p}`] = new Array(candles.length).fill(null);
    });

    if (!candles || candles.length === 0) return results;

    // Helper to get day string in Karachi time (matches PSX context)
    const getDay = (ts) => {
        return new Date(ts * 1000).toLocaleDateString('en-PK', {
            timeZone: 'Asia/Karachi',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        });
    };

    let currentDay = null;
    let dayStartIndex = 0;

    // Process all candles
    // We do this in a single pass? No, partitioning by day is safer logic.
    // 1. Identification pass
    const dayGroups = [];
    let currentGroup = [];

    for (let i = 0; i < candles.length; i++) {
        const day = getDay(candles[i].time);
        if (day !== currentDay) {
            if (currentGroup.length > 0) {
                dayGroups.push({ day: currentDay, indices: currentGroup });
            }
            currentDay = day;
            currentGroup = [i];
        } else {
            currentGroup.push(i);
        }
    }
    if (currentGroup.length > 0) dayGroups.push({ day: currentDay, indices: currentGroup });

    // 2. Calculation pass per day
    dayGroups.forEach(group => {
        const startIdx = group.indices[0];
        const sessionStartTime = candles[startIdx].time;

        // Calculate ranges for this day
        periods.forEach(minutes => {
            const durationSeconds = minutes * 60;
            const endTime = sessionStartTime + durationSeconds;

            // Find candles inside the opening range [start, start + minutes]
            // Note: We include the candle that *starts* exactly at the limit?
            // Usually [0, 5) minutes. 9:00, 9:01, 9:02, 9:03, 9:04. 9:05 is new bar.
            // Check based on time <= endTime? Or < endTime?
            // Candles are marked by Open time. The 5-minute range consists of minute bars 0,1,2,3,4.
            // Bar at '0' covers 0-1. Bar at '4' covers 4-5.
            // So we want candles where time < start + 5*60.

            let high = -Infinity;
            let low = Infinity;
            let found = false;

            for (const idx of group.indices) {
                const c = candles[idx];
                if (c.time < endTime) {
                    if (c.high > high) high = c.high;
                    if (c.low < low) low = c.low;
                    found = true;
                } else {
                    // Optimized: passed the range, no need to check further for this period in this day
                    // Wait, we assume sorted data.
                    break;
                }
            }

            // Fill the results for ALL candles in this day
            // Logic: The script plots the daily range value across the whole day (using valuewhen).
            if (found) {
                group.indices.forEach(idx => {
                    results[`up${minutes}`][idx] = high;
                    results[`down${minutes}`][idx] = low;
                });
            }
        });
    });

    return results;
}

/**
 * Calculate Previous Day High and Low
 * Includes Daily and Weekly separator markers
 * @param {Array} candles - Array of candle objects
 * @param {Object} params - { utcOffset, showSeparators }
 */
export function calculatePrevDayHL(candles, params) {
    const { utcOffset = 0, showSeparators = true } = params;
    const offsetMs = (utcOffset || 0) * 60 * 60 * 1000;

    const pdh = []; // Previous Day High
    const pdl = []; // Previous Day Low
    const markers = []; // Separator markers

    // Helpers to get day/week from timestamp + offset
    const getDay = (ts) => {
        const d = new Date((ts * 1000) + offsetMs);
        return d.getUTCDate();
    };
    const getWeek = (ts) => {
        const d = new Date((ts * 1000) + offsetMs);
        // ISO week calculation
        const date = new Date(d.getTime());
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
        const week1 = new Date(date.getFullYear(), 0, 4);
        return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    };
    const getDayName = (ts) => {
        const d = new Date((ts * 1000) + offsetMs);
        return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
    };
    const getMonthName = (ts) => {
        const d = new Date((ts * 1000) + offsetMs);
        return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
    };

    let currentDayHigh = -Infinity;
    let currentDayLow = Infinity;

    // We need to track the High/Low of the *finished* day to project it to the next day
    let prevDayHigh = null;
    let prevDayLow = null;

    for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const day = getDay(c.time);
        const week = getWeek(c.time);

        const prevC = i > 0 ? candles[i - 1] : null;
        const prevDay = prevC ? getDay(prevC.time) : null;
        const prevWeek = prevC ? getWeek(prevC.time) : null;

        const isNewDay = prevDay !== null && day !== prevDay;
        const isNewWeek = prevWeek !== null && week !== prevWeek;

        if (isNewDay) {
            // Day changed. The stats we collected (currentDayHigh/Low) are now the "Previous Day" stats
            prevDayHigh = currentDayHigh;
            prevDayLow = currentDayLow;

            // Reset for new day
            currentDayHigh = -Infinity;
            currentDayLow = Infinity;

            if (showSeparators) {
                // Add marker for new day
                const dName = getDayName(c.time);
                const dNum = new Date((c.time * 1000) + offsetMs).getUTCDate();

                markers.push({
                    time: c.time,
                    position: 'aboveBar',
                    color: isNewWeek ? '#94a3b8' : '#F59E0B', // Gray for week (to match Pine), Orange for day
                    shape: 'arrowDown',
                    text: isNewWeek ? `WEEK | ${dName} ${dNum}` : `${dName} ${dNum}`,
                });
            }
        }

        // Update current day stats
        currentDayHigh = Math.max(currentDayHigh, c.high);
        currentDayLow = Math.min(currentDayLow, c.low);

        // Assign previous day values to current candle
        pdh.push(prevDayHigh);
        pdl.push(prevDayLow);
    }

    return { pdh, pdl, markers };
}

/**
 * Filter Calculator Module
 * 
 * Calculates filter values in real-time for each tick:
 * - ORB (Opening Range Breakout) status
 * - RVOL (Relative Volume)
 * - Squeeze state
 * - Pre-breakout signals
 */

import { queryQuestDB } from '../../server/api/questdb.mjs';
import logger from './logger.mjs';

// ============ CACHES ============

// ORB levels cache (static after first 30 min)
// Map<symbol, {orb_high_5m, orb_low_5m, orb_high_15m, orb_low_15m, orb_high_30m, orb_low_30m}>
const orbCache = new Map();

// Average volume cache (from historical data)
// Map<symbol, avgVolume>
const avgVolumeCache = new Map();

// Session volume tracking (current day)
// Map<symbol, totalVolume>
const sessionVolumeCache = new Map();

// Previous day close cache (for accurate 'Day' percentage)
// Map<symbol, prevClose>
const prevCloseCache = new Map();

// First tick timestamp (to determine ORB window completion)
let firstTickTs = null;

// ORB window completion flags
let orb5mComplete = false;
let orb15mComplete = false;
let orb30mComplete = false;

// ============ INITIALIZATION ============

/**
 * Load historical avg volume for all symbols
 * Called at session start
 */
export async function loadAvgVolume() {
    try {
        const sql = `
            WITH daily_vols AS (
                SELECT 
                    symbol,
                    date_trunc('day', timestamp) as day,
                    sum(volume) as daily_vol
                FROM trades
                WHERE timestamp >= dateadd('d', -20, now())
                GROUP BY symbol, date_trunc('day', timestamp)
            )
            SELECT 
                symbol,
                avg(daily_vol) as avg_volume
            FROM daily_vols
            GROUP BY symbol
        `;

        const result = await queryQuestDB(sql);
        if (!result?.dataset) return;

        const colIndex = {};
        result.columns.forEach((col, idx) => colIndex[col.name] = idx);

        for (const row of result.dataset) {
            const symbol = row[colIndex['symbol']];
            const avgVol = parseFloat(row[colIndex['avg_volume']]) || 0;
            avgVolumeCache.set(symbol, avgVol);
        }

        logger.info({ count: avgVolumeCache.size }, 'Loaded average volume cache');
    } catch (err) {
        logger.warn({ err }, 'Failed to load avg volume cache');
    }
}

/**
 * Load previous day close for all symbols
 * Called at session start
 */
export async function loadPrevCloses() {
    try {
        // Find today's open (04:00 UTC)
        const now = new Date();
        const sessionStart = new Date(now);
        sessionStart.setUTCHours(4, 0, 0, 0);
        if (now < sessionStart) sessionStart.setDate(sessionStart.getDate() - 1);

        const anchor = sessionStart.toISOString();

        // Get last price before today's open
        const sql = `
            SELECT symbol, last(price) as prev_close
            FROM (
                SELECT symbol, price, timestamp
                FROM trades
                WHERE timestamp < '${anchor}'
                  AND timestamp >= dateadd('d', -7, '${anchor}')
                SAMPLE BY 1m ALIGN TO CALENDAR
            ) LATEST ON timestamp PARTITION BY symbol
        `;

        const result = await queryQuestDB(sql);
        if (!result?.dataset) return;

        const colIndex = {};
        result.columns.forEach((col, idx) => colIndex[col.name] = idx);

        for (const row of result.dataset) {
            const sym = row[colIndex['symbol']];
            if (!sym) continue;

            const symbol = sym.toUpperCase();
            const prevClose = parseFloat(row[colIndex['prev_close']]) || 0;
            if (prevClose > 0) {
                prevCloseCache.set(symbol, prevClose);
            }
        }

        logger.info({ count: prevCloseCache.size }, 'Loaded previous close cache');
    } catch (err) {
        logger.warn({ err }, 'Failed to load prev close cache');
    }
}

/**
 * Reset caches at session start
 */
export function resetSessionCaches() {
    sessionVolumeCache.clear();
    orbCache.clear();
    prevCloseCache.clear();
    minuteBarsCache.clear();
    sessionHighCache.clear();
    firstTickTs = null;
    orb5mComplete = false;
    orb15mComplete = false;
    orb30mComplete = false;
    logger.info('Session caches reset');
}

// ============ ORB CALCULATIONS ============

/**
 * Update ORB cache with new tick
 * ORB levels are calculated incrementally as ticks arrive
 */
function updateORBCache(symbol, tick) {
    // Set first tick timestamp
    if (!firstTickTs) {
        firstTickTs = tick.ts;
        logger.info({ firstTickTs: new Date(firstTickTs).toISOString() }, 'First tick received, starting ORB windows');
    }

    const elapsed = tick.ts - firstTickTs;
    const msFor5m = 5 * 60 * 1000;
    const msFor15m = 15 * 60 * 1000;
    const msFor30m = 30 * 60 * 1000;

    // Initialize ORB entry if needed
    if (!orbCache.has(symbol)) {
        orbCache.set(symbol, {
            orb_high_5m: tick.price,
            orb_low_5m: tick.price,
            orb_high_15m: tick.price,
            orb_low_15m: tick.price,
            orb_high_30m: tick.price,
            orb_low_30m: tick.price
        });
    }

    const orb = orbCache.get(symbol);

    // Update 5m ORB if within window
    if (elapsed < msFor5m && !orb5mComplete) {
        orb.orb_high_5m = Math.max(orb.orb_high_5m, tick.price);
        orb.orb_low_5m = Math.min(orb.orb_low_5m, tick.price);
    } else if (elapsed >= msFor5m && !orb5mComplete) {
        orb5mComplete = true;
        logger.info('ORB 5m window complete');
    }

    // Update 15m ORB if within window
    if (elapsed < msFor15m && !orb15mComplete) {
        orb.orb_high_15m = Math.max(orb.orb_high_15m, tick.price);
        orb.orb_low_15m = Math.min(orb.orb_low_15m, tick.price);
    } else if (elapsed >= msFor15m && !orb15mComplete) {
        orb15mComplete = true;
        logger.info('ORB 15m window complete');
    }

    // Update 30m ORB if within window
    if (elapsed < msFor30m && !orb30mComplete) {
        orb.orb_high_30m = Math.max(orb.orb_high_30m, tick.price);
        orb.orb_low_30m = Math.min(orb.orb_low_30m, tick.price);
    } else if (elapsed >= msFor30m && !orb30mComplete) {
        orb30mComplete = true;
        logger.info('ORB 30m window complete - all ORB levels fixed');
    }
}

/**
 * Calculate ORB breakout status for current price
 */
function calculateORBStatus(symbol, price) {
    const orb = orbCache.get(symbol);
    if (!orb) return {};

    return {
        orb_high_5m: orb.orb_high_5m,
        orb_low_5m: orb.orb_low_5m,
        orb_high_15m: orb.orb_high_15m,
        orb_low_15m: orb.orb_low_15m,
        orb_high_30m: orb.orb_high_30m,
        orb_low_30m: orb.orb_low_30m,
        orb_breakout_5m: price > orb.orb_high_5m ? 'above' : (price < orb.orb_low_5m ? 'below' : 'inside'),
        orb_breakout_15m: price > orb.orb_high_15m ? 'above' : (price < orb.orb_low_15m ? 'below' : 'inside'),
        orb_breakout_30m: price > orb.orb_high_30m ? 'above' : (price < orb.orb_low_30m ? 'below' : 'inside')
    };
}

// ============ RVOL CALCULATIONS ============

/**
 * Update session volume and calculate RVOL
 */
function calculateRVOL(symbol, tick) {
    // Track session volume
    const currentVol = sessionVolumeCache.get(symbol) || 0;
    sessionVolumeCache.set(symbol, currentVol + (tick.volume || 0));

    const sessionVol = sessionVolumeCache.get(symbol);
    const avgVol = avgVolumeCache.get(symbol) || 0;

    // Simple RVOL = session volume / avg daily volume
    // This is approximate - real RVOL would use time-adjusted average
    const rvol = avgVol > 0 ? sessionVol / avgVol : 0;

    return rvol;
}

// ============ SQUEEZE CALCULATIONS ============

// Minute bars cache for squeeze calculation
// Map<symbol, [{ts, open, high, low, close, volume}]>
const minuteBarsCache = new Map();
const SQUEEZE_LENGTH = 20;
const MULT_BB = 2.0;
const MULT_KC = 1.5;

/**
 * Update minute bars cache for squeeze calculation
 */
function updateMinuteBars(symbol, tick) {
    if (!minuteBarsCache.has(symbol)) {
        minuteBarsCache.set(symbol, []);
    }

    const bars = minuteBarsCache.get(symbol);
    const minuteKey = Math.floor(tick.ts / 60000) * 60000;

    if (bars.length === 0 || bars[bars.length - 1].ts !== minuteKey) {
        // New minute bar
        bars.push({
            ts: minuteKey,
            open: tick.price,
            high: tick.price,
            low: tick.price,
            close: tick.price,
            volume: tick.volume || 0
        });

        // Keep only last 30 bars (enough for 20-period lookback)
        if (bars.length > 30) {
            bars.shift();
        }
    } else {
        // Update current bar
        const bar = bars[bars.length - 1];
        bar.high = Math.max(bar.high, tick.price);
        bar.low = Math.min(bar.low, tick.price);
        bar.close = tick.price;
        bar.volume += tick.volume || 0;
    }
}

/**
 * Calculate squeeze state from minute bars
 * TTM Squeeze = Bollinger Bands are INSIDE Keltner Channels
 */
function calculateSqueeze(symbol) {
    const bars = minuteBarsCache.get(symbol);
    // Relaxed requirement: Allow calculation with just 5 bars so we get data early
    if (!bars || bars.length < 5) {
        return { squeeze_on: false };
    }

    // Get last N bars (up to SQUEEZE_LENGTH)
    const recentBars = bars.slice(-SQUEEZE_LENGTH);

    // Calculate SMA of close
    const closes = recentBars.map(b => b.close);
    const sma = closes.reduce((a, b) => a + b, 0) / closes.length;

    // Calculate Standard Deviation
    const variance = closes.reduce((sum, c) => sum + Math.pow(c - sma, 2), 0) / closes.length;
    const stddev = Math.sqrt(variance);

    // Calculate ATR (simplified as average of high-low)
    const trs = recentBars.map(b => b.high - b.low);
    const atr = trs.reduce((a, b) => a + b, 0) / trs.length;

    // Bollinger Bands
    const upperBB = sma + (MULT_BB * stddev);
    const lowerBB = sma - (MULT_BB * stddev);

    // Keltner Channels
    const upperKC = sma + (MULT_KC * atr);
    const lowerKC = sma - (MULT_KC * atr);

    // TTM Squeeze: BB inside KC
    const squeezeOn = (upperBB < upperKC) && (lowerBB > lowerKC);

    return {
        squeeze_on: squeezeOn,
        bb_width: upperBB - lowerBB,
        kc_width: upperKC - lowerKC
    };
}

// ============ PRE-BREAKOUT CALCULATIONS ============

// Session high cache for proximity calculation
// Map<symbol, sessionHigh>
const sessionHighCache = new Map();

/**
 * Update session high
 */
function updateSessionHigh(symbol, price) {
    const currentHigh = sessionHighCache.get(symbol) || 0;
    sessionHighCache.set(symbol, Math.max(currentHigh, price));
}

/**
 * Calculate pre-breakout signal
 * Uses same logic as bubbles.mjs - ANY of 3+ conditions triggers warning
 */
function calculatePreBreakout(symbol, price, rvol, squeezeData) {
    // Calculation DISABLED by user request
    return {
        pre_breakout_signal: 0,
        proximity: 0,
        tightness: 0,
        vol_pulse: 0
    };
}

// ============ MAIN EXPORT ============

/**
 * Calculate all filter fields for a tick
 * Called from publishTickUpdate
 * 
 * @returns Object with filter fields to include in Socket.IO payload
 */
export function calculateFilterFields(symbol, tick) {
    // Update ORB cache
    updateORBCache(symbol, tick);

    // Update minute bars for squeeze
    updateMinuteBars(symbol, tick);

    // Update session high
    updateSessionHigh(symbol, tick.price);

    // Calculate all filter values
    const orbStatus = calculateORBStatus(symbol, tick.price);
    const rvol = calculateRVOL(symbol, tick);
    const squeezeData = calculateSqueeze(symbol);
    const preBreakoutData = calculatePreBreakout(symbol, tick.price, rvol, squeezeData);

    return {
        // ORB fields
        ...orbStatus,

        // RVOL
        rvol: rvol,

        // Squeeze
        squeeze_on: squeezeData.squeeze_on,
        bb_width: squeezeData.bb_width,
        kc_width: squeezeData.kc_width,

        // Pre-breakout
        pre_breakout_signal: preBreakoutData.pre_breakout_signal,
        proximity: preBreakoutData.proximity,

        // Prev Close (ensure uppercase lookup)
        prev_close: prevCloseCache.get(symbol.toUpperCase()) || null
    };
}

export default {
    loadAvgVolume,
    loadPrevCloses,
    resetSessionCaches,
    calculateFilterFields
};

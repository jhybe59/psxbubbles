/**
 * Real-Time Publisher
 * 
 * Publishes tick updates to Redis for Socket.IO broadcasting.
 * Uses existing tick-buffer for rolling calculations.
 * 
 * PHASE 0: Infrastructure only - no behavior change to existing app.
 */

import { createClient } from 'redis';
import {
    addTick as addTickToBuffer,
    getLastNTicksOHLCV,
    TICK_INTERVALS
} from './tick-buffer.mjs';
import logger from './logger.mjs';
import { config } from './config.mjs';
import { loadAvgVolume, resetSessionCaches, calculateFilterFields } from './filter-calculator.mjs';

// Redis publisher client
let redisPublisher = null;
let isInitialized = false;

// Time-based buffers (per symbol, aggregated per minute)
const minuteBuffer = new Map(); // Map<symbol, Map<minuteKey, {open, high, low, close, volume}>>

// Day session start tracking
const sessionStart = new Map(); // Map<symbol, {open, high, low, volume, firstTs}>

// Track latest tick timestamp for relative time calculations (supports replay)
let lastTickTs = Date.now();

/**
 * Initialize Redis publisher
 */
export async function initPublisher() {
    if (isInitialized) return true;

    try {
        const redisUrl = config.redis?.url || process.env.REDIS_URL || '';
        if (!redisUrl) {
            logger.warn('Redis URL not configured, real-time publishing disabled');
            return false;
        }

        redisPublisher = createClient({ url: redisUrl });

        redisPublisher.on('error', (err) => {
            logger.warn({ err }, 'Redis publisher error (non-fatal)');
        });

        await redisPublisher.connect();
        isInitialized = true;
        logger.info('Real-time publisher initialized');

        // Load filter caches at session start
        resetSessionCaches();
        await loadAvgVolume();

        return true;
    } catch (err) {
        logger.warn({ err }, 'Failed to initialize real-time publisher (non-fatal)');
        return false;
    }
}

/**
 * Get today's session start (09:00 PKT = 04:00 UTC)
 */
function getTodaySessionStart(relativeTs) {
    const now = new Date(relativeTs || lastTickTs);
    const sessionStart = new Date(now);
    sessionStart.setUTCHours(4, 0, 0, 0);

    // If current time is before 04:00 UTC, use yesterday's session
    if (now < sessionStart) {
        sessionStart.setDate(sessionStart.getDate() - 1);
    }

    return sessionStart.getTime();
}

/**
 * Get minute key for time-based bucketing
 */
function getMinuteKey(ts) {
    return Math.floor(ts / 60000) * 60000;
}

/**
 * Update minute buffer with new tick
 */
function updateMinuteBuffer(symbol, tick) {
    if (!minuteBuffer.has(symbol)) {
        minuteBuffer.set(symbol, new Map());
    }

    const symbolMinutes = minuteBuffer.get(symbol);
    const minuteKey = getMinuteKey(tick.ts);

    if (!symbolMinutes.has(minuteKey)) {
        symbolMinutes.set(minuteKey, {
            open: tick.price,
            high: tick.price,
            low: tick.price,
            close: tick.price,
            volume: tick.volume || 0,
            ts: minuteKey
        });
    } else {
        const bar = symbolMinutes.get(minuteKey);
        bar.high = Math.max(bar.high, tick.price);
        bar.low = Math.min(bar.low, tick.price);
        bar.close = tick.price;
        bar.volume += tick.volume || 0;
    }

    // Keep only last 60 minutes (cleanup old data)
    const cutoff = lastTickTs - (60 * 60 * 1000);
    for (const [key] of symbolMinutes) {
        if (key < cutoff) {
            symbolMinutes.delete(key);
        }
    }
}

/**
 * Update day session stats
 */
function updateSessionStats(symbol, tick) {
    const todayStart = getTodaySessionStart(tick.ts);

    const stats = sessionStart.get(symbol);

    // Reset if it's a new session (detected by large time gap > 12h)
    // This allows historical replay of any date without resetting on every tick
    if (!stats || Math.abs(tick.ts - stats.firstTs) > 12 * 60 * 60 * 1000) {
        sessionStart.set(symbol, {
            open: tick.price,
            high: tick.price,
            low: tick.price,
            volume: tick.volume || 0,
            firstTs: tick.ts
        });
    } else {
        stats.high = Math.max(stats.high, tick.price);
        stats.low = Math.min(stats.low, tick.price);
        stats.volume += tick.volume || 0;
    }
}

/**
 * Calculate time-based interval OHLCV
 */
function calculateTimeInterval(symbol, minutes) {
    const symbolMinutes = minuteBuffer.get(symbol);
    if (!symbolMinutes || symbolMinutes.size === 0) {
        return null;
    }

    const cutoff = lastTickTs - (minutes * 60 * 1000);
    const bars = [];

    for (const [key, bar] of symbolMinutes) {
        if (key >= cutoff) {
            bars.push(bar);
        }
    }

    if (bars.length === 0) return null;

    // Sort by timestamp
    bars.sort((a, b) => a.ts - b.ts);

    const open = bars[0].open;
    const close = bars[bars.length - 1].close;
    const high = Math.max(...bars.map(b => b.high));
    const low = Math.min(...bars.map(b => b.low));
    const volume = bars.reduce((sum, b) => sum + b.volume, 0);
    const pct = open !== 0 ? ((close - open) / open) * 100 : 0;

    return { open, high, low, close, volume, pct };
}

/**
 * Calculate day interval OHLCV
 */
function calculateDayInterval(symbol, currentPrice) {
    const stats = sessionStart.get(symbol);
    if (!stats) {
        return { open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice, volume: 0, pct: 0 };
    }

    const pct = stats.open !== 0 ? ((currentPrice - stats.open) / stats.open) * 100 : 0;

    return {
        open: stats.open,
        high: Math.max(stats.high, currentPrice),
        low: Math.min(stats.low, currentPrice),
        close: currentPrice,
        volume: stats.volume,
        pct
    };
}

/**
 * Publish tick update to Redis
 * Called from websocket-manager.mjs on each tick
 */
export async function publishTickUpdate(symbol, tick) {
    // Update reference timestamp
    if (tick.ts > lastTickTs) {
        lastTickTs = tick.ts;
    }

    // Always update buffers (for local calculations)
    addTickToBuffer({ symbol, price: tick.price, volume: tick.volume, ts: tick.ts });
    updateMinuteBuffer(symbol, tick);
    updateSessionStats(symbol, tick);

    // Skip Redis publish if not initialized
    if (!redisPublisher || !isInitialized) {
        return;
    }

    try {
        // Build update payload with all interval data
        const data = {
            symbol,
            ts: tick.ts,
            price: tick.price,
            volume: tick.volume,
            intervals: {}
        };

        // Tick-based intervals (rolling)
        for (const n of TICK_INTERVALS) {
            const ohlcv = getLastNTicksOHLCV(symbol, n);
            if (ohlcv) {
                data.intervals[`${n}t`] = {
                    open: ohlcv.open,
                    high: ohlcv.high,
                    low: ohlcv.low,
                    close: ohlcv.close,
                    volume: ohlcv.volume,
                    pct: ohlcv.pctChange
                };
            }
        }

        // Time-based intervals (rolling)
        data.intervals['1m'] = calculateTimeInterval(symbol, 1);
        data.intervals['5m'] = calculateTimeInterval(symbol, 5);
        data.intervals['15m'] = calculateTimeInterval(symbol, 15);
        data.intervals['1h'] = calculateTimeInterval(symbol, 60);

        // Day interval
        data.intervals['Day'] = calculateDayInterval(symbol, tick.price);

        // Calculate filter fields (ORB, RVOL, etc.)
        const filterFields = calculateFilterFields(symbol, tick);
        Object.assign(data, filterFields);

        // Publish to Redis
        await redisPublisher.publish('market-data', JSON.stringify(data));

        // Log for debugging (Phase 0)
        // logger.debug({ symbol, price: tick.price }, 'Published tick update');

    } catch (err) {
        logger.warn({ err, symbol }, 'Failed to publish tick update');
    }
}

/**
 * Close publisher connection
 */
export async function closePublisher() {
    if (redisPublisher) {
        await redisPublisher.quit();
        redisPublisher = null;
        isInitialized = false;
        logger.info('Real-time publisher closed');
    }
}

export default {
    initPublisher,
    publishTickUpdate,
    closePublisher
};

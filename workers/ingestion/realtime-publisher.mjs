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
import { queryQuestDB } from '../../server/api/questdb.mjs';

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
function calculateDayInterval(symbol, currentPrice, dailyPctFromFeed = null) {
    const stats = sessionStart.get(symbol);
    if (!stats) {
        return { open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice, volume: 0, pct: 0 };
    }

    // Priority 1: Use daily % from feed (most accurate as it matches exchange)
    let pct = 0;
    if (dailyPctFromFeed != null) {
        pct = dailyPctFromFeed;
    } else {
        // Priority 2: Calculate from Open (fallback, though strictly this is intraday change)
        pct = stats.open !== 0 ? ((currentPrice - stats.open) / stats.open) * 100 : 0;
    }

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
        // We use the dailyPct derived from the feed if available (tick.dailyPct is not passed in publishTickUpdate arguments currently)
        // We need to ensure dailyPct is passed to publishTickUpdate.
        // Assuming tick object here depends on caller. 
        data.intervals['Day'] = calculateDayInterval(symbol, tick.price, tick.dailyPct);

        // Calculate filter fields (ORB, RVOL, etc.)
        const filterFields = calculateFilterFields(symbol, tick);
        Object.assign(data, filterFields);

        // Pre-Breakout Alert Handling
        if (filterFields.pre_breakout_signal === 1) {
            handlePreBreakoutAlert(symbol, tick, filterFields, data);
        }

        // Publish to Redis
        await redisPublisher.publish('market-data', JSON.stringify(data));

        // Log for debugging (Phase 0)
        // logger.debug({ symbol, price: tick.price }, 'Published tick update');

    } catch (err) {
        logger.warn({ err, symbol }, 'Failed to publish tick update');
    }
}

// Alert deduplication cache: Map<symbol, lastAlertTimestamp>
const lastAlertTime = new Map();

/**
 * Handle pre-breakout alert: publish to Redis and store in QuestDB
 */
async function handlePreBreakoutAlert(symbol, tick, filterFields, fullData) {
    const now = Date.now();
    const lastTime = lastAlertTime.get(symbol) || 0;

    // Dedup: Only alert once every 5 minutes per symbol
    if (now - lastTime < 5 * 60 * 1000) {
        return;
    }

    lastAlertTime.set(symbol, now);

    // 1. Publish to Redis for real-time toast
    const alertPayload = {
        symbol,
        price: tick.price,
        time: new Date(tick.ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        timestamp: tick.ts,
        rvol: filterFields.rvol,
        proximity: filterFields.proximity,
        tightness: filterFields.tightness
        // trigger_reason could be derived if needed
    };

    try {
        await redisPublisher.publish('pre-breakout-alerts', JSON.stringify(alertPayload));
        // logger.info({ symbol }, 'Published pre-breakout alert to Redis');
    } catch (err) {
        logger.error({ err }, 'Failed to publish pre-breakout alert to Redis');
    }

    // 2. Store in QuestDB for history
    // We use a fire-and-forget approach or non-blocking insert
    storeAlertInQuestDB(symbol, tick, filterFields).catch(err => {
        logger.warn({ err, symbol }, 'Failed to store pre-breakout alert in QuestDB');
    });
}

/**
 * Store alert in QuestDB
 */
async function storeAlertInQuestDB(symbol, tick, filterFields) {
    // Determine trigger reason based on metrics (approximate logic matching filter-calculator)
    let reason = 'squeeze';
    if (filterFields.vol_pulse >= 20) reason = 'infinite';
    else if (filterFields.vol_pulse > 3 && filterFields.proximity < 0.15) reason = 'volume_wakeup';
    else if (filterFields.proximity < 0.015) reason = 'price_action';

    // Construct SQL INSERT
    // timestamp in format: '2023-10-25T12:00:00.000000Z'
    const tsIso = new Date(tick.ts).toISOString();

    const sql = `
        INSERT INTO pre_breakout_alerts (timestamp, symbol, price, rvol, proximity, tightness, trigger_reason)
        VALUES (
            '${tsIso}',
            '${symbol}',
            ${tick.price},
            ${filterFields.rvol || 0},
            ${filterFields.proximity || 0},
            ${filterFields.tightness || 0},
            '${reason}'
        )
    `;

    await queryQuestDB(sql);
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

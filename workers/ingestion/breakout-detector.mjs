/**
 * Real-time Breakout Detector
 * 
 * Detects TTM Squeeze breakouts on each tick and publishes to Redis
 * for instant frontend notification via Socket.IO
 */
import { createClient } from 'redis';
import logger from './logger.mjs';
import { config } from './config.mjs';

let redisPublisher = null;

// Per-symbol state tracking
const symbolState = new Map();

// ORB data (set externally from main worker)
let orbData = new Map();

/**
 * Initialize Redis publisher
 */
export async function initBreakoutDetector() {
    try {
        const redisUrl = config.redis?.url || process.env.REDIS_URL || 'redis://localhost:6379';
        redisPublisher = createClient({ url: redisUrl });

        redisPublisher.on('error', (err) => {
            logger.warn({ err }, 'Redis publisher error');
        });

        await redisPublisher.connect();
        logger.info('Breakout detector initialized with Redis');
        return true;
    } catch (err) {
        logger.warn({ err }, 'Redis not available for breakout alerts');
        return false;
    }
}

/**
 * Update ORB data (call after fetching from DB)
 */
export function setORBData(data) {
    orbData = data;
}

/**
 * Check if tick triggers a breakout
 * 
 * TTM Squeeze Conditions:
 * 1. Volume above threshold (RVOL >= 1.5x)
 * 2. Price above ORB high
 * 3. Bullish candle (price > open)
 */
export async function checkBreakout(symbol, tick) {
    if (!redisPublisher) return false;

    const price = tick.price || tick.c || tick.close;
    const volume = tick.volume || tick.v || 0;

    // Get or create symbol state
    if (!symbolState.has(symbol)) {
        symbolState.set(symbol, {
            volumeHistory: [],
            lastAlertTime: 0,
            dailyOpen: price,
            alerted: false
        });
    }

    const state = symbolState.get(symbol);

    // Update volume history for RVOL calculation
    state.volumeHistory.push(volume);
    if (state.volumeHistory.length > 20) {
        state.volumeHistory.shift();
    }

    // Calculate RVOL
    const avgVolume = state.volumeHistory.length > 1
        ? state.volumeHistory.slice(0, -1).reduce((a, b) => a + b, 0) / (state.volumeHistory.length - 1)
        : volume;
    const rvol = avgVolume > 0 ? volume / avgVolume : 1;

    // Get ORB data for this symbol
    const orb = orbData.get(symbol);
    const orbHigh = orb?.orb_high_5m || null;

    // Breakout conditions
    const hasVolume = rvol >= 1.5;
    const aboveORB = orbHigh && price > orbHigh;
    const isBullish = price > state.dailyOpen;

    const isBreakout = hasVolume && aboveORB && isBullish;

    // Prevent duplicate alerts (minimum 5 minutes between alerts for same symbol)
    const now = Date.now();
    const cooldown = 5 * 60 * 1000; // 5 minutes

    if (isBreakout && !state.alerted && (now - state.lastAlertTime) > cooldown) {
        state.alerted = true;
        state.lastAlertTime = now;

        // Calculate percentage change
        const pct = state.dailyOpen > 0
            ? ((price - state.dailyOpen) / state.dailyOpen) * 100
            : 0;

        const alert = {
            symbol,
            price,
            rvol: parseFloat(rvol.toFixed(2)),
            pct: parseFloat(pct.toFixed(2)),
            time: new Date().toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
            timestamp: now
        };

        // Publish to Redis
        try {
            await redisPublisher.publish('breakout-alerts', JSON.stringify(alert));
            logger.info({ alert }, 'Published breakout alert to Redis');
            return true;
        } catch (err) {
            logger.error({ err }, 'Failed to publish breakout alert');
        }
    }

    // Reset alerted flag if conditions no longer met
    if (!isBreakout && state.alerted) {
        state.alerted = false;
    }

    return false;
}

/**
 * Reset daily state (call at market open)
 */
export function resetDailyState() {
    symbolState.clear();
    logger.info('Breakout detector daily state reset');
}

export default { initBreakoutDetector, setORBData, checkBreakout, resetDailyState };

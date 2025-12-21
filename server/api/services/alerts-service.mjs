/**
 * Alerts Service
 * Detects trading events with their exact timestamps for the current session
 * Returns alerts for display in BubbleTooltip
 */
import { queryQuestDB } from '../questdb.mjs';
import logger from '../logger.mjs';

/**
 * Format timestamp to HH:MM (PKT)
 */
function formatTime(isoString) {
    if (!isoString) return null;
    try {
        const d = new Date(isoString);
        // Add 5 hours for PKT
        d.setHours(d.getHours() + 5);
        return d.toTimeString().slice(0, 5);
    } catch {
        return null;
    }
}

/**
 * Get all session alerts for symbols
 * @param {string[]} symbols - List of symbols
 * @param {string} dayStart - ISO timestamp for session start (04:00 UTC)
 * @param {Object} orbMap - Pre-calculated ORB levels from bubbles.mjs
 * @param {Object} prevDayMap - Previous day high/close data
 * @returns {Promise<Map<string, Array>>} - Map of symbol -> alerts array
 */
export async function getSessionAlerts(symbols, dayStart, orbMap = new Map(), prevDayMap = new Map()) {
    const alertsMap = new Map();

    if (!symbols || symbols.length === 0) return alertsMap;

    // Initialize empty arrays for all symbols
    symbols.forEach(s => alertsMap.set(s, []));

    const symbolFilter = `symbol IN (${symbols.map(s => `'${s}'`).join(',')})`;

    try {
        // Run all detection queries in parallel
        const [
            orbBreakouts,
            dailyExtremes,
            prevDayBreakouts,
            volumeSpikes,
            vwapCrosses
        ] = await Promise.all([
            detectORBBreakouts(symbolFilter, dayStart, orbMap),
            detectDailyExtremes(symbolFilter, dayStart),
            detectPrevDayBreakouts(symbolFilter, dayStart, prevDayMap),
            detectVolumeSpikes(symbolFilter, dayStart),
            detectVWAPCrosses(symbolFilter, dayStart)
        ]);

        // Merge all alerts into the map
        const allAlerts = [...orbBreakouts, ...dailyExtremes, ...prevDayBreakouts, ...volumeSpikes, ...vwapCrosses];

        for (const alert of allAlerts) {
            const arr = alertsMap.get(alert.symbol);
            if (arr) {
                arr.push({
                    type: alert.type,
                    text: alert.text,
                    time: alert.time,
                    category: alert.category || 'D'
                });
            }
        }

        // Sort each symbol's alerts by time (earliest first, then reverse for display)
        for (const [sym, arr] of alertsMap) {
            arr.sort((a, b) => {
                if (!a.time) return 1;
                if (!b.time) return -1;
                return a.time.localeCompare(b.time);
            });
            // Reverse so latest is first
            arr.reverse();
        }

        return alertsMap;
    } catch (err) {
        logger.error({ err }, 'Failed to get session alerts');
        return alertsMap;
    }
}

/**
 * Detect ORB Breakouts (5m, 15m, 30m)
 */
async function detectORBBreakouts(symbolFilter, dayStart, orbMap) {
    const alerts = [];

    if (orbMap.size === 0) return alerts;

    // Build conditions for each symbol's ORB levels
    const timeframes = ['5m', '15m', '30m'];

    for (const [symbol, orb] of orbMap) {
        for (const tf of timeframes) {
            const highKey = `orb_high_${tf}`;
            const lowKey = `orb_low_${tf}`;

            if (orb[highKey]) {
                // Check high breakout
                const hRes = await queryQuestDB(`
                    SELECT min(timestamp) 
                    FROM minute_bars 
                    WHERE symbol = '${symbol}' 
                    AND timestamp >= '${dayStart}' 
                    AND close > ${orb[highKey]}
                `);
                if (hRes?.dataset?.[0]?.[0]) {
                    alerts.push({
                        symbol,
                        type: 'bullish',
                        text: `✅ Crossed ORB ${tf} High`,
                        time: formatTime(hRes.dataset[0][0]),
                        category: 'D'
                    });
                }
            }

            if (orb[lowKey]) {
                // Check low breakout
                const lRes = await queryQuestDB(`
                    SELECT min(timestamp) 
                    FROM minute_bars 
                    WHERE symbol = '${symbol}' 
                    AND timestamp >= '${dayStart}' 
                    AND close < ${orb[lowKey]}
                `);
                if (lRes?.dataset?.[0]?.[0]) {
                    alerts.push({
                        symbol,
                        type: 'bearish',
                        text: `⚠️ Crossed ORB ${tf} Low`,
                        time: formatTime(lRes.dataset[0][0]),
                        category: 'D'
                    });
                }
            }
        }
    }

    return alerts;
}

/**
 * Detect Daily High/Low times
 */
async function detectDailyExtremes(symbolFilter, dayStart) {
    const alerts = [];

    // Get time of daily high and low for each symbol
    const sql = `
        WITH extremes AS (
            SELECT 
                symbol,
                max(high) as day_high,
                min(low) as day_low
            FROM minute_bars
            WHERE ${symbolFilter}
            AND timestamp >= '${dayStart}'
            GROUP BY symbol
        ),
        high_times AS (
            SELECT m.symbol, min(m.timestamp) as ts_high
            FROM minute_bars m
            JOIN extremes e ON m.symbol = e.symbol AND m.high = e.day_high
            WHERE m.timestamp >= '${dayStart}'
            GROUP BY m.symbol
        ),
        low_times AS (
            SELECT m.symbol, min(m.timestamp) as ts_low
            FROM minute_bars m
            JOIN extremes e ON m.symbol = e.symbol AND m.low = e.day_low
            WHERE m.timestamp >= '${dayStart}'
            GROUP BY m.symbol
        )
        SELECT h.symbol, h.ts_high, l.ts_low
        FROM high_times h
        LEFT JOIN low_times l ON h.symbol = l.symbol
    `;

    try {
        const res = await queryQuestDB(sql);
        if (!res?.dataset) return alerts;

        for (const row of res.dataset) {
            const [symbol, tsHigh, tsLow] = row;

            if (tsHigh) {
                alerts.push({
                    symbol,
                    type: 'bullish',
                    text: '💥 Daily High',
                    time: formatTime(tsHigh),
                    category: 'D'
                });
            }

            if (tsLow) {
                alerts.push({
                    symbol,
                    type: 'bearish',
                    text: '📉 Daily Low',
                    time: formatTime(tsLow),
                    category: 'D'
                });
            }
        }
    } catch (err) {
        logger.warn({ err }, 'Failed to detect daily extremes');
    }

    return alerts;
}

/**
 * Detect Previous Day High/Low Breakouts
 */
async function detectPrevDayBreakouts(symbolFilter, dayStart, prevDayMap) {
    const alerts = [];

    if (prevDayMap.size === 0) return alerts;

    for (const [symbol, prev] of prevDayMap) {
        if (prev.prev_high) {
            const hRes = await queryQuestDB(`
                SELECT min(timestamp) 
                FROM minute_bars 
                WHERE symbol = '${symbol}' 
                AND timestamp >= '${dayStart}' 
                AND close > ${prev.prev_high}
            `);
            if (hRes?.dataset?.[0]?.[0]) {
                alerts.push({
                    symbol,
                    type: 'bullish',
                    text: '🚀 Broke Prev Day High',
                    time: formatTime(hRes.dataset[0][0]),
                    category: 'D'
                });
            }
        }

        if (prev.prev_low) {
            const lRes = await queryQuestDB(`
                SELECT min(timestamp) 
                FROM minute_bars 
                WHERE symbol = '${symbol}' 
                AND timestamp >= '${dayStart}' 
                AND close < ${prev.prev_low}
            `);
            if (lRes?.dataset?.[0]?.[0]) {
                alerts.push({
                    symbol,
                    type: 'bearish',
                    text: '🔻 Broke Prev Day Low',
                    time: formatTime(lRes.dataset[0][0]),
                    category: 'D'
                });
            }
        }
    }

    return alerts;
}

/**
 * Detect Volume Spikes (1m volume > 10x average)
 */
async function detectVolumeSpikes(symbolFilter, dayStart) {
    const alerts = [];

    const sql = `
        WITH avg_vols AS (
            SELECT symbol, avg(volume) as avg_vol
            FROM minute_bars
            WHERE ${symbolFilter}
            AND timestamp >= dateadd('d', -5, '${dayStart}')
            AND timestamp < '${dayStart}'
            GROUP BY symbol
        ),
        spikes AS (
            SELECT m.symbol, min(m.timestamp) as ts_spike
            FROM minute_bars m
            JOIN avg_vols a ON m.symbol = a.symbol
            WHERE m.timestamp >= '${dayStart}'
            AND m.volume > a.avg_vol * 10
            AND ${symbolFilter.replace('symbol', 'm.symbol')}
            GROUP BY m.symbol
        )
        SELECT * FROM spikes
    `;

    try {
        const res = await queryQuestDB(sql);
        if (!res?.dataset) return alerts;

        for (const row of res.dataset) {
            const [symbol, tsSpike] = row;
            if (tsSpike) {
                alerts.push({
                    symbol,
                    type: 'bullish',
                    text: '⚡ Volume Spike',
                    time: formatTime(tsSpike),
                    category: 'D'
                });
            }
        }
    } catch (err) {
        logger.warn({ err }, 'Failed to detect volume spikes');
    }

    return alerts;
}

/**
 * Detect VWAP Crosses
 * VWAP = Cumulative(close * volume) / Cumulative(volume)
 */
async function detectVWAPCrosses(symbolFilter, dayStart) {
    const alerts = [];

    // Calculate VWAP per bar, then find crosses
    const sql = `
        WITH vwap_data AS (
            SELECT 
                symbol,
                timestamp,
                close,
                sum(close * volume) OVER (PARTITION BY symbol ORDER BY timestamp) / 
                    NULLIF(sum(volume) OVER (PARTITION BY symbol ORDER BY timestamp), 0) as vwap,
                lag(close) OVER (PARTITION BY symbol ORDER BY timestamp) as prev_close
            FROM minute_bars
            WHERE ${symbolFilter}
            AND timestamp >= '${dayStart}'
        ),
        cross_up AS (
            SELECT symbol, min(timestamp) as ts
            FROM vwap_data
            WHERE close > vwap AND prev_close < vwap AND prev_close IS NOT NULL
            GROUP BY symbol
        ),
        cross_down AS (
            SELECT symbol, min(timestamp) as ts
            FROM vwap_data
            WHERE close < vwap AND prev_close > vwap AND prev_close IS NOT NULL
            GROUP BY symbol
        )
        SELECT 'up' as dir, symbol, ts FROM cross_up
        UNION ALL
        SELECT 'down' as dir, symbol, ts FROM cross_down
    `;

    try {
        const res = await queryQuestDB(sql);
        if (!res?.dataset) return alerts;

        for (const row of res.dataset) {
            const [dir, symbol, ts] = row;
            if (ts) {
                alerts.push({
                    symbol,
                    type: dir === 'up' ? 'bullish' : 'bearish',
                    text: dir === 'up' ? '📊 VWAP Cross Up' : '📊 VWAP Cross Down',
                    time: formatTime(ts),
                    category: 'D'
                });
            }
        }
    } catch (err) {
        logger.warn({ err }, 'Failed to detect VWAP crosses');
    }

    return alerts;
}

export default {
    getSessionAlerts
};

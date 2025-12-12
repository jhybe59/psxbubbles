/**
 * ORB (Opening Range Breakout) API
 * 
 * Calculates ORB High/Low values for all symbols based on:
 * - Market-wide first tick of the day (handles variable market open times)
 * - Multiple ORB windows: 5m, 15m, 30m
 * - Real-time breakout status calculation
 */
import { Router } from 'express';
import { z } from 'zod';
import { queryQuestDB } from '../questdb.mjs';
import logger from '../logger.mjs';

const router = Router();

// Supported ORB windows in minutes
const ORB_WINDOWS = [5, 15, 30];

const schema = z.object({
    window: z.coerce.number().int().refine(val => ORB_WINDOWS.includes(val), {
        message: `window must be one of: ${ORB_WINDOWS.join(', ')}`
    }).optional()
});

/**
 * Get market-wide first tick timestamp of the day
 * This handles variable market open times (Friday 9:17, normal 9:30, winter timing)
 */
async function getMarketOpenTick() {
    const sql = `
        SELECT MIN(timestamp) as first_tick
        FROM trades
        WHERE timestamp >= date_trunc('day', now())
    `;

    const result = await queryQuestDB(sql);

    if (!result || !result.dataset || result.dataset.length === 0 || !result.dataset[0][0]) {
        return null;
    }

    return result.dataset[0][0];
}

/**
 * Calculate ORB values for all symbols
 * @param {number} windowMinutes - ORB window size in minutes (5, 15, or 30)
 */
async function calculateORB(windowMinutes) {
    // Step 1: Get market-wide first tick
    const marketOpenTick = await getMarketOpenTick();

    if (!marketOpenTick) {
        logger.warn('No trades found for today - cannot calculate ORB');
        return { orbStart: null, data: [] };
    }

    // Step 2: Calculate ORB High/Low for each symbol within the window
    const orbSql = `
        SELECT 
            symbol,
            MAX(price) as orb_high,
            MIN(price) as orb_low,
            first(price) as orb_open,
            last(price) as orb_close,
            count(*) as tick_count
        FROM trades
        WHERE timestamp >= '${marketOpenTick}'
          AND timestamp < dateadd('m', ${windowMinutes}, '${marketOpenTick}')
        GROUP BY symbol
    `;

    const orbResult = await queryQuestDB(orbSql);

    if (!orbResult || !orbResult.dataset) {
        return { orbStart: marketOpenTick, data: [] };
    }

    // Step 3: Get current prices for breakout detection
    const currentPriceSql = `
        SELECT symbol, price
        FROM trades
        LATEST ON timestamp PARTITION BY symbol
    `;

    const currentResult = await queryQuestDB(currentPriceSql);
    const currentPrices = new Map();

    if (currentResult && currentResult.dataset) {
        for (const row of currentResult.dataset) {
            currentPrices.set(row[0], parseFloat(row[1]) || 0);
        }
    }

    // Step 4: Build response with breakout status
    const columns = orbResult.columns || [];
    const colIndex = {};
    columns.forEach((col, idx) => {
        colIndex[col.name] = idx;
    });

    const orbData = [];

    for (const row of orbResult.dataset) {
        const symbol = row[colIndex['symbol']];
        const orbHigh = parseFloat(row[colIndex['orb_high']]) || 0;
        const orbLow = parseFloat(row[colIndex['orb_low']]) || 0;
        const orbOpen = parseFloat(row[colIndex['orb_open']]) || 0;
        const orbClose = parseFloat(row[colIndex['orb_close']]) || 0;
        const tickCount = parseInt(row[colIndex['tick_count']]) || 0;

        const currentPrice = currentPrices.get(symbol) || 0;

        // Calculate breakout status
        let breakoutStatus = 'inside';
        if (currentPrice > orbHigh) {
            breakoutStatus = 'above';
        } else if (currentPrice < orbLow) {
            breakoutStatus = 'below';
        }

        // Calculate ORB range percentage
        const orbRange = orbHigh - orbLow;
        const orbRangePct = orbLow > 0 ? (orbRange / orbLow) * 100 : 0;

        orbData.push({
            symbol,
            orb_high: orbHigh,
            orb_low: orbLow,
            orb_open: orbOpen,
            orb_close: orbClose,
            orb_range: orbRange,
            orb_range_pct: orbRangePct,
            current_price: currentPrice,
            breakout_status: breakoutStatus,
            tick_count: tickCount,
            window_minutes: windowMinutes
        });
    }

    return {
        orbStart: marketOpenTick,
        windowMinutes,
        symbolCount: orbData.length,
        data: orbData
    };
}

/**
 * GET /api/orb
 * Returns ORB data for all symbols
 * 
 * Query params:
 * - window: ORB window in minutes (5, 15, or 30, default: 15)
 */
router.get('/', async (req, res) => {
    const start = Date.now();

    try {
        const parsed = schema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid parameters',
                details: parsed.error.errors,
                validWindows: ORB_WINDOWS
            });
        }

        const windowMinutes = parsed.data.window || 15; // Default to 15m ORB

        const result = await calculateORB(windowMinutes);

        const duration = Date.now() - start;
        logger.info({ duration, window: windowMinutes, count: result.data.length }, 'ORB query');

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('X-Response-Time', `${duration}ms`);

        res.json({
            meta: {
                orbStart: result.orbStart,
                windowMinutes: result.windowMinutes,
                symbolCount: result.symbolCount,
                calculatedAt: new Date().toISOString()
            },
            data: result.data
        });
    } catch (err) {
        logger.error({ err }, 'ORB endpoint error');
        res.status(500).json({ error: 'Failed to calculate ORB data' });
    }
});

/**
 * GET /api/orb/all
 * Returns ORB data for all windows (5m, 15m, 30m) combined
 */
router.get('/all', async (req, res) => {
    const start = Date.now();

    try {
        // Get market open tick once
        const marketOpenTick = await getMarketOpenTick();

        if (!marketOpenTick) {
            return res.json({
                meta: { orbStart: null, message: 'No trades found for today' },
                data: {}
            });
        }

        // Calculate ORB for all windows
        const results = {};
        for (const window of ORB_WINDOWS) {
            const orbResult = await calculateORB(window);
            results[`${window}m`] = orbResult.data;
        }

        // Merge all ORB data by symbol
        const mergedData = new Map();

        for (const [windowKey, orbData] of Object.entries(results)) {
            for (const item of orbData) {
                if (!mergedData.has(item.symbol)) {
                    mergedData.set(item.symbol, {
                        symbol: item.symbol,
                        current_price: item.current_price
                    });
                }

                const existing = mergedData.get(item.symbol);
                existing[`orb_high_${windowKey}`] = item.orb_high;
                existing[`orb_low_${windowKey}`] = item.orb_low;
                existing[`orb_breakout_${windowKey}`] = item.breakout_status;
            }
        }

        const duration = Date.now() - start;
        logger.info({ duration, count: mergedData.size }, 'ORB all windows query');

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('X-Response-Time', `${duration}ms`);

        res.json({
            meta: {
                orbStart: marketOpenTick,
                windows: ORB_WINDOWS,
                symbolCount: mergedData.size,
                calculatedAt: new Date().toISOString()
            },
            data: Array.from(mergedData.values())
        });
    } catch (err) {
        logger.error({ err }, 'ORB all endpoint error');
        res.status(500).json({ error: 'Failed to calculate ORB data' });
    }
});

/**
 * GET /api/orb/breakouts
 * Returns only symbols that have broken out above ORB high (Long signals)
 */
router.get('/breakouts', async (req, res) => {
    const start = Date.now();

    try {
        const parsed = schema.safeParse(req.query);
        const windowMinutes = parsed.success && parsed.data.window ? parsed.data.window : 15;

        const result = await calculateORB(windowMinutes);

        // Filter only breakouts above ORB high
        const breakouts = result.data.filter(item => item.breakout_status === 'above');

        // Sort by how far above ORB high (percentage)
        breakouts.sort((a, b) => {
            const aAbove = a.orb_high > 0 ? ((a.current_price - a.orb_high) / a.orb_high) * 100 : 0;
            const bAbove = b.orb_high > 0 ? ((b.current_price - b.orb_high) / b.orb_high) * 100 : 0;
            return bAbove - aAbove;
        });

        const duration = Date.now() - start;
        logger.info({ duration, window: windowMinutes, breakouts: breakouts.length }, 'ORB breakouts query');

        res.json({
            meta: {
                orbStart: result.orbStart,
                windowMinutes,
                totalSymbols: result.data.length,
                breakoutCount: breakouts.length,
                calculatedAt: new Date().toISOString()
            },
            data: breakouts
        });
    } catch (err) {
        logger.error({ err }, 'ORB breakouts endpoint error');
        res.status(500).json({ error: 'Failed to get ORB breakouts' });
    }
});

export default router;

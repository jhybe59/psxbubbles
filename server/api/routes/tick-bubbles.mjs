/**
 * Tick-based bubbles endpoint
 * Returns bubble data using last N rows from QuestDB
 * 
 * OPTIMIZED: Single query instead of per-symbol queries
 */
import { Router } from 'express';
import { z } from 'zod';
import { queryQuestDB } from '../questdb.mjs';
import logger from '../logger.mjs';

const router = Router();

const TICK_INTERVALS = [10, 100, 500, 1000];

const schema = z.object({
    ticks: z.coerce.number().int().refine(val => TICK_INTERVALS.includes(val), {
        message: `ticks must be one of: ${TICK_INTERVALS.join(', ')}`
    }).optional(),
});

/**
 * GET /api/tick-bubbles
 * 
 * Gets the last N*100 rows (for ~100 symbols), then calculates OHLCV per symbol in JS
 * This is much faster than 100 separate queries
 */
router.get('/', async (req, res) => {
    const start = Date.now();

    try {
        const parsed = schema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Invalid parameters',
                details: parsed.error.errors,
                validIntervals: TICK_INTERVALS
            });
        }

        const tickCount = parsed.data.ticks || 100;

        // Get recent data - enough rows for all symbols
        // For 100 symbols * 1000 ticks = 100,000 rows max
        const limit = Math.min(tickCount * 150, 150000);

        const sql = `
            SELECT symbol, price, volume, timestamp 
            FROM trades 
            ORDER BY timestamp DESC 
            LIMIT ${limit}
        `;

        const result = await queryQuestDB(sql);

        if (!result || !result.dataset || result.dataset.length === 0) {
            return res.json([]);
        }

        // Group by symbol and take last N ticks for each
        const symbolData = new Map();

        for (const row of result.dataset) {
            const symbol = row[0];
            const close = parseFloat(row[1]) || 0; // price is now in column 1
            const volume = parseFloat(row[2]) || 0;
            const ts = row[3];

            if (!symbolData.has(symbol)) {
                symbolData.set(symbol, []);
            }

            const ticks = symbolData.get(symbol);
            if (ticks.length < tickCount) {
                ticks.push({ close, volume, ts });
            }
        }

        // Calculate OHLCV for each symbol
        const bubbles = [];

        for (const [symbol, ticks] of symbolData.entries()) {
            if (ticks.length === 0) continue;

            // Ticks are in DESC order (newest first)
            const prices = ticks.map(t => t.close);
            const volumes = ticks.map(t => t.volume);

            const closePrice = prices[0]; // newest
            const openPrice = prices[prices.length - 1]; // oldest
            const high = Math.max(...prices);
            const low = Math.min(...prices);
            const volume = volumes.reduce((a, b) => a + b, 0);

            const pctChange = openPrice !== 0 ? ((closePrice - openPrice) / openPrice) * 100 : 0;

            const endTs = ticks[0].ts;
            const startTs = ticks[ticks.length - 1].ts;
            const timeElapsedMs = new Date(endTs).getTime() - new Date(startTs).getTime();

            bubbles.push({
                symbol,
                price: closePrice,
                open: openPrice,
                high,
                low,
                close: closePrice,
                volume,
                pct_24h: 0,
                pct_interval: pctChange,
                interval: `${tickCount}_ticks`,
                timeElapsedMs,
                ts: endTs,
                startTs,
                tickCount: ticks.length,
                hasEnoughTicks: ticks.length >= tickCount,
                availableTicks: ticks.length
            });
        }

        const duration = Date.now() - start;
        logger.info({ duration, count: bubbles.length, ticks: tickCount }, 'Tick bubbles query');

        res.json(bubbles);
    } catch (err) {
        logger.error({ err }, 'Tick bubbles endpoint error');
        res.status(500).json({ error: 'Failed to fetch tick bubble data' });
    }
});

/**
 * GET /api/tick-bubbles/status
 */
router.get('/status', async (req, res) => {
    try {
        const countSql = `SELECT count(*) as total, count_distinct(symbol) as symbols FROM trades`;
        const result = await queryQuestDB(countSql);

        let totalRows = 0;
        let totalSymbols = 0;

        if (result && result.dataset && result.dataset[0]) {
            totalRows = parseInt(result.dataset[0][0]) || 0;
            totalSymbols = parseInt(result.dataset[0][1]) || 0;
        }

        res.json({
            summary: {
                source: 'QuestDB',
                totalRows,
                totalSymbols,
                intervals: TICK_INTERVALS,
                avgTicksPerSymbol: totalSymbols > 0 ? Math.round(totalRows / totalSymbols) : 0
            }
        });
    } catch (err) {
        logger.error({ err }, 'Tick status endpoint error');
        res.status(500).json({ error: 'Failed to get tick status' });
    }
});

export default router;

/**
 * Tick-based bubbles endpoint
 * Returns bubble data for symbols using their last N ticks
 */
import { Router } from 'express';
import { z } from 'zod';
import { getAllSymbolsOHLCV, getBufferStatus, TICK_INTERVALS } from '../../workers/ingestion/tick-buffer.mjs';
import logger from '../logger.mjs';

const router = Router();

const schema = z.object({
    ticks: z.coerce.number().int().refine(val => TICK_INTERVALS.includes(val), {
        message: `ticks must be one of: ${TICK_INTERVALS.join(', ')}`
    }).optional(),
    // If ticks not specified, returns all intervals
});

/**
 * GET /api/tick-bubbles
 * Query params:
 *   - ticks: 10, 100, 500, or 1000 (optional, returns all if not specified)
 * 
 * Response format matches bubbles endpoint:
 * [
 *   {
 *     symbol: 'LUCK',
 *     price: 100.5,
 *     open: 99.0,
 *     high: 101.0,
 *     low: 98.5,
 *     close: 100.5,
 *     volume: 50000,
 *     pct_interval: 1.52,
 *     interval: '100_ticks',
 *     timeElapsedMs: 240000,
 *     ts: '2024-01-01T12:00:00Z'
 *   },
 *   ...
 * ]
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

        const { ticks } = parsed.data;

        // Default to 100 ticks if not specified
        const tickCount = ticks || 100;

        // Get OHLCV for all symbols using their LAST N ticks (immediate, no waiting)
        const bubbles = getAllSymbolsOHLCV(tickCount);

        // Transform to match existing bubbles API format
        const transformed = bubbles.map(b => ({
            symbol: b.symbol,
            price: b.close,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume,
            pct_24h: 0, // Not available for tick data
            pct_interval: b.pctChange,
            interval: `${b.interval}_ticks`,
            timeElapsedMs: b.timeElapsedMs,
            ts: b.endTs ? new Date(b.endTs).toISOString() : null,
            startTs: b.startTs ? new Date(b.startTs).toISOString() : null,
            tickCount: b.tickCount,
            hasEnoughTicks: b.hasEnoughTicks,
            availableTicks: b.availableTicks
        }));

        const duration = Date.now() - start;
        logger.debug({ duration, count: transformed.length, ticks: tickCount }, 'Tick bubbles query');

        res.json(transformed);
    } catch (err) {
        logger.error({ err }, 'Tick bubbles endpoint error');
        res.status(500).json({ error: 'Failed to fetch tick bubble data' });
    }
});

/**
 * GET /api/tick-bubbles/status
 * Returns buffer status for debugging
 */
router.get('/status', async (req, res) => {
    try {
        const status = getBufferStatus();
        const symbolCount = Object.keys(status).length;

        // Summary stats
        const summary = {
            totalSymbols: symbolCount,
            intervals: TICK_INTERVALS,
            symbolsWithEnoughTicks: {}
        };

        // Count symbols that have enough ticks for each interval
        for (const interval of TICK_INTERVALS) {
            const count = Object.values(status).filter(s => s.tickCount >= interval).length;
            summary.symbolsWithEnoughTicks[`${interval}_ticks`] = count;
        }

        res.json({ summary, details: status });
    } catch (err) {
        logger.error({ err }, 'Tick status endpoint error');
        res.status(500).json({ error: 'Failed to get buffer status' });
    }
});

export default router;

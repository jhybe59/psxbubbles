/**
 * Tick-based candles endpoint
 * Generates OHLCV bars based on trade count (e.g. 100 trades = 1 candle)
 */
import { Router } from 'express';
import { z } from 'zod';
import { queryQuestDB } from '../questdb.mjs';
import logger from '../logger.mjs';

const router = Router();

// Validation schema
const schema = z.object({
    symbol: z.string().transform(s => s.toUpperCase()),
    interval: z.enum(['10T', '100T', '500T', '1000T']).default('100T'),
    limit: z.coerce.number().int().min(1).max(1000).default(100)
});

/**
 * GET /api/tick-candles
 * Example: /api/tick-candles?symbol=BTC&interval=100T&limit=50
 */
router.get('/', async (req, res) => {
    const start = Date.now();
    try {
        const parsed = schema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid parameters', details: parsed.error.errors });
        }

        const { symbol, interval, limit } = parsed.data;
        const tickCount = parseInt(interval.replace('T', ''));

        // We need (limit * tickCount) raw rows to build 'limit' candles
        // e.g. 50 candles * 100 ticks = 5000 rows
        const neededRows = limit * tickCount;

        // Safety cap
        const maxRows = 100000;

        // Fetch one extra row to calculate volume delta for the oldest tick in the set
        const fetchLimit = Math.min(neededRows + 1, maxRows);

        const sql = `
            SELECT timestamp, price, volume
            FROM trades
            WHERE symbol = '${symbol}'
            ORDER BY timestamp DESC
            LIMIT ${neededRows}
        `;

        const result = await queryQuestDB(sql);

        if (!result || !result.dataset || result.dataset.length === 0) {
            return res.json({
                symbol,
                interval,
                count: 0,
                data: []
            });
        }

        // Processing: Group ticks into buckets
        // Data comes in DESC order (newest first)
        const rawRows = result.dataset; // [ts, close, volume]
        const candles = [];

        let currentBatch = [];

        for (let i = 0; i < rawRows.length; i++) {
            if (currentBatch.length < tickCount) {
                const row = rawRows[i];
                // QuestDB column indices: 0:timestamp, 1:price, 2:volume

                // Ensure we parse numbers correctly
                const price = parseFloat(row[1]);
                const vol = parseFloat(row[2]) || 0; // Handle nulls as 0
                const ts = row[0];

                currentBatch.push({ price, vol, ts });

                if (currentBatch.length === tickCount) {
                    // Create candle from batch
                    candles.push(createCandleFromBatch(currentBatch));
                    currentBatch = [];
                }
            }
        }

        // Reverse to be chronological (oldest to newest)
        candles.reverse();

        const duration = Date.now() - start;
        res.set('X-Response-Time', `${duration}ms`);
        res.set('X-Debug-Version', 'v2-msg-vol-sum');

        res.json({
            symbol,
            interval,
            count: candles.length,
            data: candles
        });

    } catch (err) {
        logger.error({ err }, 'Tick candles endpoint error');
        res.status(500).json({ error: 'Failed to fetch tick candles' });
    }
});

function createCandleFromBatch(batch) {
    // batch is [newest, ..., oldest]
    // Timestamps are ISO strings or numbers? QuestDB returns strings typically, but we should check.
    // If we assume standard array order from push:

    // Logic:
    // Open = Oldest Price
    // Close = Newest Price
    // High = Max Price in batch
    // Low = Min Price in batch
    // Volume = Sum of all individual trade volumes

    const newest = batch[0];
    const oldest = batch[batch.length - 1];
    const prices = batch.map(b => b.price);

    // Sum volume
    const volume = batch.reduce((sum, item) => sum + item.vol, 0);

    return {
        ts: oldest.ts,
        open: oldest.price,
        close: newest.price,
        high: Math.max(...prices),
        low: Math.min(...prices),
        volume: volume,
        count: batch.length
    };
}

export default router;

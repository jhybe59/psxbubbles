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
        const fetchLimit = Math.min(neededRows, maxRows);

        const sql = `
            SELECT timestamp, price, volume
            FROM trades
            WHERE symbol = '${symbol}'
            ORDER BY timestamp DESC
            LIMIT ${fetchLimit}
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
        // We need to group them from newest backwards, then reverse for chart

        const rawRows = result.dataset; // [ts, close, volume]
        const candles = [];

        let currentBatch = [];

        for (const row of rawRows) {
            // QuestDB column indices based on query: 0:timestamp, 1:price, 2:volume
            // We use 'price' from the trades table

            const price = parseFloat(row[1]);
            const vol = parseFloat(row[2]);
            const ts = row[0]; // ISO string

            currentBatch.push({ price, vol, ts });

            if (currentBatch.length === tickCount) {
                // Batch full, create candle
                candles.push(createCandleFromBatch(currentBatch));
                currentBatch = [];
            }
        }

        // Optionally handle partial last batch? 
        // usually charts prefer full bars. We'll skip the partial remainder at the very end of history.

        // Reverse to be chronological (oldest to newest)
        candles.reverse();

        const duration = Date.now() - start;
        res.set('X-Response-Time', `${duration}ms`);

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
    // batch is [newest, ..., oldest] because we iterated desc source
    // So Open is the last item, Close is the first item

    // BUT wait, we pushed them in order of appearance in the loop.
    // Loop iterated query result (DESC).
    // So first item pushed = Newest tick.
    // Last item pushed = Oldest tick in that batch.

    const newest = batch[0];
    const oldest = batch[batch.length - 1];

    const prices = batch.map(b => b.price);

    return {
        ts: oldest.ts, // Candle start time
        open: oldest.price,
        close: newest.price,
        high: Math.max(...prices),
        low: Math.min(...prices),
        volume: batch.reduce((sum, b) => sum + b.vol, 0),
        count: batch.length
    };
}

export default router;

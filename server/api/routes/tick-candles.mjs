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
        const rawRows = result.dataset; // [ts, close, volume]
        const candles = [];

        let currentBatch = [];

        // We iterate and form batches.
        // Batch i uses rows[i] to rows[i+tickCount-1]
        // Volume for batch = rows[i].volume - rows[i+tickCount].volume (baseline)

        for (let i = 0; i < rawRows.length; i++) {
            // If we don't have enough rows left to fill a batch, we stop
            // unless we want partial? usually charts prefer consistent bars.
            // With +1 fetch, we might have an extra row at the end purely for volume calc.

            if (currentBatch.length < tickCount) {
                const row = rawRows[i];
                // QuestDB column indices: 0:timestamp, 1:price, 2:volume

                const price = parseFloat(row[1]);
                const vol = parseFloat(row[2]);
                const ts = row[0];

                currentBatch.push({ price, vol, ts });

                if (currentBatch.length === tickCount) {
                    // Look ahead for baseline volume
                    // The baseline is the volume of the tick *immediately preceding* this batch chronologically.
                    // Since we iterate DESC, that is rawRows[i+1].

                    let baselineVol = 0;
                    if (i + 1 < rawRows.length) {
                        baselineVol = parseFloat(rawRows[i + 1][2]) || 0;
                    } else {
                        // We are at the end of the fetched data.
                        // We can't perfectly calc volume for the oldest item in this batch.
                        // Approx: subtract nothing? or subtract the volume of the oldest item itself (approx 0 for that tick)?
                        // Safest: Use the oldest item's volume as its own baseline (yielding 0 for that last tick)?
                        // Better: Just use 0 if we assume start of day, but we might be mid-day.
                        // Fallback: use oldest item's volume - 0? No, that gives huge volume.
                        // Fallback: use oldest item's volume as baseline (so volume for that tick is 0).
                        baselineVol = currentBatch[currentBatch.length - 1].vol;
                    }

                    candles.push(createCandleFromBatch(currentBatch, baselineVol));
                    currentBatch = [];
                }
            }
        }

        // Reverse to be chronological (oldest to newest)
        candles.reverse();

        const duration = Date.now() - start;
        res.set('X-Response-Time', `${duration}ms`);
        res.set('X-Debug-Version', 'v2');

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

function createCandleFromBatch(batch, baselineVol) {
    // batch is [newest, ..., oldest]

    const newest = batch[0];
    const oldest = batch[batch.length - 1];
    const prices = batch.map(b => b.price);

    // Calculate Volume
    // Cumulative Volume at End (Newest) = newest.vol
    // Cumulative Volume at Start (Oldest's prev) = baselineVol

    const endVol = newest.vol;

    let volume = 0;
    if (endVol >= baselineVol) {
        volume = endVol - baselineVol;
    } else {
        // Reset occurred? e.g. endVol much smaller than baseline. 
        // e.g. New Day started.
        // Assume endVol is the total volume since reset.
        volume = endVol;
    }

    // Sanity check: if volume < 0, set 0
    if (volume < 0) volume = 0;

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

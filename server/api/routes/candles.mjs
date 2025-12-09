import { Router } from 'express';
import { z } from 'zod';
import { queryQuestDB } from '../questdb.mjs';
import logger from '../logger.mjs';

const router = Router();

// Validation schema
const schema = z.object({
    symbol: z.string().transform(s => s.toUpperCase()),
    interval: z.enum(['5m', '15m', '1h', 'Day']).default('Day'),
    limit: z.coerce.number().int().min(1).max(5000).default(336) // Default ~2 weeks of hourly data
});

/**
 * Build aggregated candle query
 */
function buildCandleQuery(symbol, interval, limit) {
    const sampleByMap = {
        '5m': '5m',
        '15m': '15m',
        '1h': '1h',
        'Day': '1d'
    };

    const sampleBy = sampleByMap[interval] || '1h';

    // QuestDB aggregation for candles
    // We explicitly select the columns needed for correct OHLCV transformation
    let sql = `
    SELECT 
      timestamp as ts,
      first(open) as open,
      max(high) as high,
      min(low) as low,
      last(close) as close,
      sum(volume) as volume,
      sum(value) as value
    FROM minute_bars
    WHERE symbol = '${symbol}'
  `;

    // Optimization: Pre-filter by roughly the time range needed to avoid scanning entire table
    // Assuming worst case (sparse data), we might grab more, but 'limit' at the end clips it.
    // For 'Day' limit 365, we need 1 year. For '1h', 336 = 2 weeks.

    let hoursBack = 24;
    if (interval === 'Day') hoursBack = limit * 24;
    else if (interval === '1h') hoursBack = limit;
    else if (interval === '15m') hoursBack = Math.ceil(limit / 4);
    else if (interval === '5m') hoursBack = Math.ceil(limit / 12);

    // Add a buffer
    hoursBack = Math.ceil(hoursBack * 1.5);

    sql += ` AND timestamp > dateadd('h', -${hoursBack}, now())`;

    sql += ` SAMPLE BY ${sampleBy} ALIGN TO CALENDAR`;
    sql += ` ORDER BY ts DESC`;
    sql += ` LIMIT ${limit}`;

    return sql;
}

router.get('/', async (req, res) => {
    const start = Date.now();
    try {
        const parsed = schema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid parameters', details: parsed.error.errors });
        }

        const { symbol, interval, limit } = parsed.data;

        const sql = buildCandleQuery(symbol, interval, limit);
        const result = await queryQuestDB(sql);

        // Transform response
        // QuestDB returns columns: ts, open, high, low, close, volume, value
        // We need to map this to an array of objects

        let data = [];
        if (result && result.dataset) {
            // dataset is array of arrays. columns array tells us the index.
            // usually order matches select but best to be safe via col index if dynamic, 
            // but here we control the query strictly.
            // Indices: 0:ts, 1:open, 2:high, 3:low, 4:close, 5:volume

            data = result.dataset.map(row => ({
                ts: row[0], // ISO string
                open: row[1],
                high: row[2],
                low: row[3],
                close: row[4],
                volume: row[5],
                value: row[6]
            }));

            // Sort ascending for chart usage
            data.reverse();
        }

        const duration = Date.now() - start;
        res.set('X-Response-Time', `${duration}ms`);

        res.json({
            symbol,
            interval,
            count: data.length,
            data
        });

    } catch (err) {
        logger.error({ err }, 'Candles endpoint error');
        res.status(500).json({ error: 'Failed to fetch candles' });
    }
});

export default router;

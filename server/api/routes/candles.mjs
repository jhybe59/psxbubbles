import { Router } from 'express';
import { z } from 'zod';
import { queryQuestDB } from '../questdb.mjs';
import logger from '../logger.mjs';

const router = Router();

// Validation schema
const schema = z.object({
    symbol: z.string().transform(s => s.toUpperCase()),
    interval: z.enum(['1m', '5m', '15m', '1h', '4h', 'Day', 'Week', 'Month', 'Year']).default('Day'),
    limit: z.coerce.number().int().min(1).max(5000).default(336), // Default ~2 weeks of hourly data
    to: z.string().optional() // ISO timestamp or QuestDB date string
});

/**
 * Build aggregated candle query
 */
function buildCandleQuery(symbol, interval, limit, to = null) {
    const sampleByMap = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '1h': '1h',
        '4h': '4h',
        'Day': '1d',
        'Week': '1w',
        'Month': '1M',
        'Year': '12M'
    };

    const sampleBy = sampleByMap[interval] || '1h';

    // QuestDB aggregation for candles
    // We explicitly select the columns needed for correct OHLCV transformation
    let sql = `
    SELECT 
      timestamp as ts,
      first(close) as open,
      max(close) as high,
      min(close) as low,
      last(close) as close,
      (max(volume) - min(volume)) as volume,
      (max(value) - min(value)) as value
    FROM minute_bars
    WHERE symbol = '${symbol}'
  `;

    // Optimization: Pre-filter by roughly the time range needed to avoid scanning entire table
    let hoursBack = 24;
    switch (interval) {
        case '1m': hoursBack = Math.ceil(limit / 60); break;
        case '5m': hoursBack = Math.ceil(limit / 12); break;
        case '15m': hoursBack = Math.ceil(limit / 4); break;
        case '1h': hoursBack = limit; break;
        case '4h': hoursBack = limit * 4; break;
        case 'Day': hoursBack = limit * 24; break;
        case 'Week': hoursBack = limit * 24 * 7; break;
        case 'Month': hoursBack = limit * 24 * 30; break;
        case 'Year': hoursBack = limit * 24 * 365; break;
        default: hoursBack = 24;
    }

    // Add a buffer - Ensure at least 1 week of data is scanned to cover weekends/holidays
    hoursBack = Math.max(Math.ceil(hoursBack * 1.5), 168);

    const anchor = to ? `'${to}'` : 'now()';
    sql += ` AND timestamp > dateadd('h', -${hoursBack}, ${anchor})`;

    if (to) {
        sql += ` AND timestamp <= '${to}'`;
    }

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

        const { symbol, interval, limit, to } = parsed.data;

        const sql = buildCandleQuery(symbol, interval, limit, to);
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

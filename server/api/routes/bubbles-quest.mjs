/**
 * QuestDB-based bubbles endpoint for testing
 * Uses LATEST ON for instant per-symbol results
 */
import { Router } from 'express';
import { z } from 'zod';
import { queryQuestDB } from '../questdb.mjs';
import { getCache, setCache } from '../cache.mjs';
import logger from '../logger.mjs';

const router = Router();

const schema = z.object({
    interval: z.enum(['1m', '5m', '15m', '1h', 'Day']).default('1m'),
    limit: z.coerce.number().int().min(1).max(1000).default(100),
    indices: z
        .string()
        .transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean))
        .optional(),
    favorites: z
        .string()
        .transform((value) => value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean))
        .optional()
});

/**
 * Build LATEST ON query for real-time data
 */
function buildLatestQuery(symbols = null) {
    let sql = `
    SELECT 
      symbol,
      ts,
      open,
      high,
      low,
      close,
      volume,
      value,
      daily_pct
    FROM minute_bars
    LATEST ON ts PARTITION BY symbol
  `;

    if (symbols && symbols.length > 0) {
        const symbolList = symbols.map(s => `'${s}'`).join(',');
        sql += ` WHERE symbol IN (${symbolList})`;
    }

    return sql;
}

/**
 * Build aggregated query using SAMPLE BY
 */
function buildAggregatedQuery(interval, symbols = null, limit = 100) {
    const sampleByMap = {
        '5m': '5m',
        '15m': '15m',
        '1h': '1h',
        'Day': '1d'
    };

    const sampleBy = sampleByMap[interval] || '5m';

    // For aggregated intervals, we need a different approach
    // First get latest per symbol, then aggregate
    let sql = `
    SELECT 
      symbol,
      ts,
      first(open) as open,
      max(high) as high,
      min(low) as low,
      last(close) as close,
      sum(volume) as volume,
      sum(value) as value,
      last(daily_pct) as daily_pct
    FROM minute_bars
  `;

    if (symbols && symbols.length > 0) {
        const symbolList = symbols.map(s => `'${s}'`).join(',');
        sql += ` WHERE symbol IN (${symbolList})`;
    }

    sql += ` SAMPLE BY ${sampleBy}`;
    sql += ` ORDER BY symbol, ts DESC`;
    sql += ` LIMIT ${limit}`;

    return sql;
}

/**
 * Transform QuestDB response to match existing API format
 */
function transformResponse(result, interval) {
    if (!result || !result.dataset) {
        return [];
    }

    const columns = result.columns || [];
    const colIndex = {};
    columns.forEach((col, idx) => {
        colIndex[col.name] = idx;
    });

    // Group by symbol and take the latest row for each
    const symbolMap = new Map();

    for (const row of result.dataset) {
        const symbol = row[colIndex['symbol']];

        // Only keep first (latest) row per symbol
        if (!symbolMap.has(symbol)) {
            const ts = row[colIndex['ts']];
            const close = parseFloat(row[colIndex['close']]) || 0;
            const open = parseFloat(row[colIndex['open']]) || 0;
            const high = parseFloat(row[colIndex['high']]) || 0;
            const low = parseFloat(row[colIndex['low']]) || 0;
            const volume = parseFloat(row[colIndex['volume']]) || 0;
            const value = parseFloat(row[colIndex['value']]) || 0;
            const dailyPct = parseFloat(row[colIndex['daily_pct']]) || 0;

            // Calculate interval percentage change
            const intervalPct = open !== 0 ? ((close - open) / open) * 100 : 0;

            symbolMap.set(symbol, {
                symbol,
                price: close,
                open,
                high,
                low,
                close,
                volume,
                value,
                pct_24h: dailyPct,
                pct_interval: intervalPct,
                interval,
                ts: typeof ts === 'string' ? ts : new Date(ts).toISOString()
            });
        }
    }

    return Array.from(symbolMap.values());
}

router.get('/', async (req, res) => {
    const start = Date.now();

    try {
        const parsed = schema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid parameters', details: parsed.error.errors });
        }

        const { interval, limit, indices, favorites } = parsed.data;

        // Build cache key
        const cacheKey = `bubbles-quest:${interval}:${limit}:${(indices || []).join(',')}:${(favorites || []).join(',')}`;

        // Check cache (short TTL for real-time data)
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        // Determine which symbols to query
        let symbols = null;
        if (favorites && favorites.length > 0) {
            symbols = favorites;
        }
        // TODO: Add index-based symbol lookup from PostgreSQL if needed

        // Build and execute query
        let sql;
        if (interval === '1m') {
            sql = buildLatestQuery(symbols);
        } else {
            sql = buildAggregatedQuery(interval, symbols, limit);
        }

        const result = await queryQuestDB(sql);
        const transformed = transformResponse(result, interval);

        // Cache for 5 seconds (real-time data)
        await setCache(cacheKey, transformed, 5);

        const duration = Date.now() - start;
        logger.debug({ duration, count: transformed.length, interval }, 'QuestDB bubbles query');

        res.json(transformed);
    } catch (err) {
        logger.error({ err }, 'QuestDB bubbles endpoint error');
        res.status(500).json({ error: 'Failed to fetch data from QuestDB' });
    }
});

export default router;

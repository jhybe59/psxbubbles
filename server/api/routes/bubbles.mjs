import { Router } from 'express';
import { z } from 'zod';
import { withClient } from '../db.mjs';
import { getCache, setCache } from '../cache.mjs';
import logger from '../logger.mjs';

const router = Router();

const intervalMap = {
  '1m': 'minute_bars',
  '5m': 'minute_bars_5m',
  '15m': 'minute_bars_15m',
  '1h': 'minute_bars_1h',
  Day: 'minute_bars_1d'
};

const schema = z.object({
  interval: z.enum(['1m', '5m', '15m', '1h', 'Day']).default('Day'),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  sort: z.enum(['pct', 'volume', 'symbol']).optional(),
  indices: z
    .string()
    .transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean))
    .optional(),
  favorites: z
    .string()
    .transform((value) => value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean))
    .optional()
});

const buildOrderClause = (sort, favoritesPlaceholder) => {
  const statements = [];
  if (favoritesPlaceholder) {
    statements.push(`CASE WHEN symbol = ANY(${favoritesPlaceholder}) THEN 0 ELSE 1 END`);
  }

  switch (sort) {
    case 'volume':
      statements.push('volume DESC');
      break;
    case 'symbol':
      statements.push('symbol ASC');
      break;
    default:
      statements.push('interval_pct DESC NULLS LAST');
  }

  statements.push('symbol ASC');
  return statements.join(', ');
};

const latestRawQuery = ({ limit, indices, favorites }) => {
  const params = [];
  let paramIndex = 1;

  const whereClauses = [];
  if (indices?.length) {
    params.push(indices.map((code) => code.toUpperCase()));
    whereClauses.push(`symbol IN (SELECT symbol FROM index_members WHERE index_code = ANY($${paramIndex}))`);
    paramIndex += 1;
  }

  const favoritesParam = favorites?.length ? `$${paramIndex}` : null;
  if (favorites?.length) {
    params.push(favorites);
    paramIndex += 1;
  }

  params.push(limit);
  const limitParam = `$${paramIndex}`;

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    WITH ranked AS (
      SELECT
        symbol,
        ts,
        close AS price,
        volume,
        value,
        daily_pct,
        LAG(close) OVER (PARTITION BY symbol ORDER BY ts) AS prev_close,
        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY ts DESC) AS rk
      FROM minute_bars
    ), latest AS (
      SELECT symbol, ts, price, volume, value, daily_pct,
        CASE WHEN prev_close IS NULL OR prev_close = 0 THEN NULL
             ELSE (price - prev_close) / prev_close * 100 END AS interval_pct
      FROM ranked
      WHERE rk = 1
    )
    SELECT symbol, ts, price, COALESCE(interval_pct, 0) AS interval_pct, daily_pct, volume, value
    FROM latest
    ${where}
    ORDER BY ${buildOrderClause('pct', favoritesParam)}
    LIMIT ${limitParam};
  `;

  return { sql, params };
};

const aggregateQuery = ({ interval, limit, indices, favorites }) => {
  const viewName = intervalMap[interval];
  const params = [];
  let paramIndex = 1;

  const whereClauses = ['bucket = (SELECT max(bucket) FROM ' + viewName + ')'];
  if (indices?.length) {
    params.push(indices.map((code) => code.toUpperCase()));
    whereClauses.push(`symbol IN (SELECT symbol FROM index_members WHERE index_code = ANY($${paramIndex}))`);
    paramIndex += 1;
  }

  const favoritesParam = favorites?.length ? `$${paramIndex}` : null;
  if (favorites?.length) {
    params.push(favorites);
    paramIndex += 1;
  }

  params.push(limit);
  const limitParam = `$${paramIndex}`;

  const sql = `
    SELECT
      symbol,
      bucket,
      close AS price,
      COALESCE(pct_change, 0) AS interval_pct,
      daily_pct,
      volume_sum AS volume,
      turnover_sum AS value
    FROM ${viewName}
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY ${buildOrderClause('pct', favoritesParam)}
    LIMIT ${limitParam};
  `;

  return { sql, params };
};

const hydrateResponse = (rows, interval) => ({
  interval,
  asOf: rows.length ? rows.reduce((latest, row) => {
    const ts = row.bucket ?? row.ts;
    return ts && ts > latest ? ts : latest;
  }, 0) : null,
  symbols: rows.map((row) => ({
    symbol: row.symbol,
    price: Number(row.price),
    intervalPct: Number(row.interval_pct ?? 0),
    dailyPct: row.daily_pct != null ? Number(row.daily_pct) : null,
    volume: row.volume != null ? Number(row.volume) : null,
    turnover: row.value != null ? Number(row.value) : null,
    ts: row.bucket ?? row.ts
  }))
});

router.get('/', async (req, res, next) => {
  let parsed;
  try {
    parsed = schema.parse(req.query);
  } catch (err) {
    res.status(400).json({ error: { code: 'INVALID_PARAMS', message: err.message } });
    return;
  }

  const cacheKey = `bubbles:${parsed.interval}:${parsed.limit}:${parsed.indices?.join('|') ?? ''}:${parsed.favorites?.join('|') ?? ''}`;
  try {
    if (parsed.interval !== '1m') {
      const cached = await getCache(cacheKey);
      if (cached) {
        res.set('X-Cache', 'HIT');
        res.json(cached);
        return;
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Cache fetch failed');
  }

  try {
    const queryBuilder = parsed.interval === '1m' ? latestRawQuery : aggregateQuery;
    const { sql, params } = queryBuilder(parsed);

    const rows = await withClient(async (client) => {
      const result = await client.query(sql, params);
      return result.rows;
    });

    const payload = hydrateResponse(rows, parsed.interval);

    if (parsed.interval !== '1m') {
      await setCache(cacheKey, payload, parsed.interval === 'Day' ? 60 : 15);
    }

    res.set('X-Cache', 'MISS');
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;


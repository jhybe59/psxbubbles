import { Router } from 'express';
import { z } from 'zod';
import { withClient } from '../db.mjs';
import { getCache, setCache } from '../cache.mjs';
import logger from '../logger.mjs';

const router = Router();

const schema = z.object({
  interval: z.enum(['1m', '5m', '15m', '1h', 'Day']).default('Day'),
  index: z.string().optional()
});

const intervalView = {
  '1m': 'minute_bars',
  '5m': 'minute_bars_5m',
  '15m': 'minute_bars_15m',
  '1h': 'minute_bars_1h',
  Day: 'minute_bars_1d'
};

const snapshotSql = (interval, indexFilter) => {
  const view = intervalView[interval];
  const usingAggregates = interval !== '1m';
  const bucketColumn = usingAggregates ? 'bucket' : 'ts';
  const baseTable = usingAggregates ? view : 'minute_bars';

  const whereClauses = [];
  const params = [];
  let idx = 1;

  if (usingAggregates) {
    whereClauses.push(`${bucketColumn} = (SELECT max(${bucketColumn}) FROM ${view})`);
  }

  if (indexFilter) {
    params.push(indexFilter);
    whereClauses.push(`symbol IN (SELECT symbol FROM index_members WHERE index_code = $${idx})`);
    idx += 1;
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const priceField = usingAggregates ? 'close' : 'close';
  const pctField = usingAggregates ? 'pct_change' : '((close - LAG(close) OVER (PARTITION BY symbol ORDER BY ts)) / NULLIF(LAG(close) OVER (PARTITION BY symbol ORDER BY ts), 0) * 100)';
  const volumeField = usingAggregates ? 'volume_sum' : 'volume';
  const valueField = usingAggregates ? 'turnover_sum' : 'value';

  const sql = `
    WITH dataset AS (
      SELECT symbol,
        ${priceField} AS price,
        ${usingAggregates ? 'COALESCE(pct_change, 0)' : 'COALESCE(' + pctField + ', 0)'} AS interval_pct,
        ${volumeField} AS volume,
        ${valueField} AS value
      FROM ${baseTable}
      ${where}
    )
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE interval_pct > 0) AS advancers,
      COUNT(*) FILTER (WHERE interval_pct < 0) AS decliners,
      COUNT(*) FILTER (WHERE interval_pct = 0) AS unchanged,
      SUM(volume) AS total_volume,
      SUM(value) AS total_turnover,
      AVG(interval_pct) AS avg_move,
      MAX(price) AS high_price,
      MIN(price) AS low_price
    FROM dataset;
  `;

  return { sql, params };
};

router.get('/', async (req, res) => {
  let parsed;
  try {
    parsed = schema.parse(req.query);
  } catch (err) {
    res.status(400).json({ error: { code: 'INVALID_PARAMS', message: err.message } });
    return;
  }

  const cacheKey = `snapshots:${parsed.interval}:${parsed.index ?? 'all'}`;
  try {
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      res.json(cached);
      return;
    }
  } catch (err) {
    logger.warn({ err }, 'Cache fetch failed');
  }

  try {
    const { sql, params } = snapshotSql(parsed.interval, parsed.index);
    const row = await withClient(async (client) => {
      const result = await client.query(sql, params);
      return result.rows[0];
    });

    const payload = {
      interval: parsed.interval,
      index: parsed.index ?? null,
      totals: {
        symbols: Number(row.total || 0),
        advancers: Number(row.advancers || 0),
        decliners: Number(row.decliners || 0),
        unchanged: Number(row.unchanged || 0)
      },
      aggregates: {
        volume: row.total_volume != null ? Number(row.total_volume) : null,
        turnover: row.total_turnover != null ? Number(row.total_turnover) : null,
        averageMove: row.avg_move != null ? Number(row.avg_move) : null,
        highPrice: row.high_price != null ? Number(row.high_price) : null,
        lowPrice: row.low_price != null ? Number(row.low_price) : null
      }
    };

    await setCache(cacheKey, payload, parsed.interval === 'Day' ? 60 : 15);

    res.set('X-Cache', 'MISS');
    res.json(payload);
  } catch (err) {
    logger.error({ err }, 'Failed to build snapshot response');
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Snapshot query failed' } });
  }
});

export default router;


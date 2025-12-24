import { Router } from 'express';
import { z } from 'zod';
import { queryQuestDB } from '../questdb.mjs';
import { getCache, setCache } from '../cache.mjs';
import logger from '../logger.mjs';

const router = Router();

const schema = z.object({
  interval: z.enum(['1m', '5m', '15m', '1h', 'Day']).default('Day'),
  index: z.string().optional()
});

/**
 * Map API interval to QuestDB SAMPLE BY syntax
 */
const intervalMap = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  'Day': '1d' // QuestDB doesn't have 'Day', uses '1d'
};

const snapshotSqlQuest = (interval, indexFilter) => {
  const sampleBy = intervalMap[interval] || '1d';
  const lookback = interval === 'Day' ? '7d' : '24h';

  // Logic:
  // 1. Get latest candle for each symbol.
  // 2. Aggregate counts/volumes from that result.

  const indexClause = indexFilter ? `AND symbol IN (SELECT symbol FROM index_members WHERE index_code = '${indexFilter}')` : '';

  // We first fetch the latest candle for all symbols
  const cte = `
    WITH latest_candles AS (
      SELECT 
        symbol,
        first(price) as open,
        last(price) as close,
        sum(volume) as vol,
        sum(value) as val,
        timestamp
      FROM trades
      WHERE timestamp >= dateadd('${lookback.endsWith('d') ? 'd' : 'h'}', -${parseInt(lookback)}, now())
        ${indexClause}
      SAMPLE BY ${sampleBy} ALIGN TO CALENDAR
    ),
    latest_final AS (
      SELECT * FROM latest_candles LATEST ON timestamp PARTITION BY symbol
    )
    SELECT
      count() as total,
      sum(case when close > open then 1 else 0 end) as advancers,
      sum(case when close < open then 1 else 0 end) as decliners,
      sum(case when close = open then 1 else 0 end) as unchanged,
      sum(vol) as total_volume,
      sum(val) as total_turnover,
      avg( (close - open) / open * 100 ) as avg_move,
      max(close) as high_price,
      min(close) as low_price
    FROM latest_final
    WHERE open > 0
  `;

  return cte;
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
    const sql = snapshotSqlQuest(parsed.interval, parsed.index);
    const result = await queryQuestDB(sql);

    // QuestDB returns [ [total, adv, dec, unch, vol, val, avg, high, low] ]
    let row = {
      total: 0, advancers: 0, decliners: 0, unchanged: 0,
      total_volume: 0, total_turnover: 0, avg_move: 0,
      high_price: 0, low_price: 0
    };

    if (result && result.dataset && result.dataset.length > 0) {
      const r = result.dataset[0];
      row = {
        total: r[0],
        advancers: r[1],
        decliners: r[2],
        unchanged: r[3],
        total_volume: r[4],
        total_turnover: r[5],
        avg_move: r[6],
        high_price: r[7],
        low_price: r[8]
      };
    }

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


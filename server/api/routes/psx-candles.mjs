import { Router } from 'express';
import { queryQuestDB } from '../questdb.mjs';
import logger from '../logger.mjs';

const router = Router();
const SAMPLE_INTERVALS = new Map([
  ['1m', null],
  ['5m', '5m'],
  ['15m', '15m'],
  ['1h', '1h'],
  ['4h', '4h'],
  ['Day', '1d'],
  ['Week', '1w'],
  ['Month', '1M'],
  ['Year', '1y']
]);

router.get('/', async (req, res) => {
  const symbol = String(req.query.symbol || '').trim().toUpperCase();
  const limit = Math.min(500, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
  const interval = String(req.query.interval || '1m');
  if (!SAMPLE_INTERVALS.has(interval)) {
    return res.status(400).json({ error: { code: 'INVALID_INTERVAL', message: 'Supported intervals: 1m, 5m, 15m, 1h, 4h, Day, Week, Month, Year' } });
  }
  if (!/^[A-Z0-9._-]{1,24}$/.test(symbol)) {
    return res.status(400).json({ error: { code: 'INVALID_SYMBOL', message: 'A valid symbol query parameter is required' } });
  }

  try {
    const sampleInterval = SAMPLE_INTERVALS.get(interval);
    const sql = sampleInterval
      ? `
        SELECT symbol, received_at as timestamp,
               first(open) as open, max(high) as high, min(low) as low,
               last(close) as close, sum(volume) as volume,
               first(first_source_timestamp) as first_source_timestamp,
               last(last_source_timestamp) as last_source_timestamp
        FROM psx_1m_bars
        WHERE symbol = '${symbol}'
        SAMPLE BY ${sampleInterval}
        ORDER BY received_at DESC
        LIMIT ${limit}
      `
      : `
        SELECT symbol, received_at as timestamp, open, high, low, close, volume,
               first_source_timestamp, last_source_timestamp
        FROM psx_1m_bars
        WHERE symbol = '${symbol}'
        ORDER BY received_at DESC
        LIMIT ${limit}
      `;
    const result = await queryQuestDB(sql);
    const indexes = Object.fromEntries((result.columns || []).map((column, index) => [column.name, index]));
    const rows = (result.dataset || []).map((row) => ({
      symbol: row[indexes.symbol],
      timestamp: row[indexes.timestamp],
      open: Number(row[indexes.open]),
      high: Number(row[indexes.high]),
      low: Number(row[indexes.low]),
      close: Number(row[indexes.close]),
      volume: Number(row[indexes.volume]),
      firstSourceTimestamp: row[indexes.first_source_timestamp],
      lastSourceTimestamp: row[indexes.last_source_timestamp]
    }));
    const byBucket = new Map();
    for (const row of rows) byBucket.set(row.timestamp, row);
    const data = [...byBucket.values()].reverse();
    return res.json({ meta: { count: data.length, symbol, interval, source: 'psx-terminal' }, data });
  } catch (error) {
    logger.error({ err: error, symbol }, 'Failed to read PSX one-minute candles');
    return res.status(503).json({ error: { code: 'CANDLE_READ_FAILED', message: 'PSX candle data is temporarily unavailable' } });
  }
});

export default router;

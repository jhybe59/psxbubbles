import { Router } from 'express';
import { queryQuestDB } from '../questdb.mjs';
import logger from '../logger.mjs';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const result = await queryQuestDB(`
      SELECT symbol, last_price, cumulative_volume, change_percent,
             day_high, day_low, market_status, market, source_timestamp, received_at
      FROM psx_quotes
      LATEST ON received_at PARTITION BY symbol
    `);
    const columnIndex = Object.fromEntries((result.columns || []).map((column, index) => [column.name, index]));
    const numberOrNull = (value) => value == null ? null : Number(value);
    const data = (result.dataset || []).map((row) => {
      const price = numberOrNull(row[columnIndex.last_price]);
      const sourceTimestamp = row[columnIndex.source_timestamp] || null;
      const receivedAt = row[columnIndex.received_at] || null;
      const sourceAgeMs = sourceTimestamp ? Math.max(0, Date.now() - Date.parse(sourceTimestamp)) : null;
      const receiveAgeMs = receivedAt ? Math.max(0, Date.now() - Date.parse(receivedAt)) : null;
      const stale = receiveAgeMs == null || receiveAgeMs > 60_000 || (sourceAgeMs != null && sourceAgeMs > 60_000);
      const changePercent = numberOrNull(row[columnIndex.change_percent]);
      return {
        symbol: row[columnIndex.symbol],
        price,
        open: price,
        high: numberOrNull(row[columnIndex.day_high]) ?? price,
        low: numberOrNull(row[columnIndex.day_low]) ?? price,
        volume: numberOrNull(row[columnIndex.cumulative_volume]) ?? 0,
        day_volume: numberOrNull(row[columnIndex.cumulative_volume]) ?? 0,
        pct_24h: changePercent ?? 0,
        pct_interval: changePercent ?? 0,
        marketStatus: row[columnIndex.market_status] || null,
        market: row[columnIndex.market] || null,
        sourceTimestamp,
        receivedAt,
        sourceAgeMs,
        receiveAgeMs,
        stale,
        ts: sourceTimestamp || receivedAt
      };
    });

    res.json({ meta: { count: data.length, source: 'psx-terminal' }, data });
  } catch (error) {
    logger.error({ err: error }, 'Failed to read PSX Terminal quote snapshots');
    res.status(503).json({ error: { code: 'QUOTE_READ_FAILED', message: 'PSX quote feed is temporarily unavailable' } });
  }
});

export default router;

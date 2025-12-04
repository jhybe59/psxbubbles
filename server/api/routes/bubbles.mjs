import { Router } from 'express';
import { z } from 'zod';
import { withClient } from '../db.mjs';
import { getCache, setCache } from '../cache.mjs';
import logger from '../logger.mjs';

// Get symbols list from environment variable (optional)
const getSymbolsList = () => {
  const symbolsEnv = process.env.PSX_API_SYMBOLS_LIST;
  if (symbolsEnv) {
    return symbolsEnv.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  }
  return null;
};

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

  // Filter by configured symbols if available (from env var)
  const configuredSymbols = getSymbolsList();
  if (configuredSymbols && configuredSymbols.length > 0) {
    params.push(configuredSymbols);
    whereClauses.push(`symbol = ANY($${paramIndex})`);
    paramIndex += 1;
  }

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
        open,
        high,
        low,
        volume,
        value,
        daily_pct,
        raw,
        LAG(close) OVER (PARTITION BY symbol ORDER BY ts) AS prev_close,
        LAG(open) OVER (PARTITION BY symbol ORDER BY ts) AS prev_open,
        LAG(high) OVER (PARTITION BY symbol ORDER BY ts) AS prev_high,
        LAG(low) OVER (PARTITION BY symbol ORDER BY ts) AS prev_low,
        LAG(volume) OVER (PARTITION BY symbol ORDER BY ts) AS prev_volume,
        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY ts DESC) AS rk
      FROM minute_bars
      ${where}
    ), latest AS (
      SELECT symbol, ts, price, open, high, low, volume, value, daily_pct, raw, prev_close, prev_open, prev_high, prev_low, prev_volume,
        CASE WHEN prev_close IS NULL OR prev_close = 0 THEN daily_pct
             ELSE (price - prev_close) / prev_close * 100 END AS interval_pct
      FROM ranked
      WHERE rk = 1
    ),
    daily_24h_stats AS (
      -- Calculate 24h statistics for coin modal (always full day)
      SELECT DISTINCT ON (l.symbol)
        l.symbol,
        (
          SELECT MAX(high) 
          FROM minute_bars 
          WHERE symbol = l.symbol 
            AND ts >= l.ts - INTERVAL '24 hours'
            AND ts <= l.ts
        ) AS daily_high,
        (
          SELECT MIN(low) 
          FROM minute_bars 
          WHERE symbol = l.symbol 
            AND ts >= l.ts - INTERVAL '24 hours'
            AND ts <= l.ts
        ) AS daily_low,
        (
          SELECT SUM(volume) 
          FROM minute_bars 
          WHERE symbol = l.symbol 
            AND ts >= l.ts - INTERVAL '24 hours'
            AND ts <= l.ts
        ) AS daily_volume,
        (
          SELECT SUM(value) 
          FROM minute_bars 
          WHERE symbol = l.symbol 
            AND ts >= l.ts - INTERVAL '24 hours'
            AND ts <= l.ts
        ) AS daily_value,
        (
          SELECT open 
          FROM minute_bars 
          WHERE symbol = l.symbol 
            AND ts >= l.ts - INTERVAL '24 hours'
            AND ts <= l.ts
          ORDER BY ts ASC
          LIMIT 1
        ) AS daily_open
      FROM latest l
    ),
    lookback_stats AS (
      -- Calculate rolling aggregates for flexible strategy builder
      SELECT DISTINCT ON (l.symbol)
        l.symbol,
        -- 5 minute lookback
        (SELECT MAX(high) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '5 minutes' AND ts < l.ts) AS max_high_5m,
        (SELECT MIN(low) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '5 minutes' AND ts < l.ts) AS min_low_5m,
        (SELECT MAX(close) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '5 minutes' AND ts < l.ts) AS max_close_5m,
        (SELECT MIN(close) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '5 minutes' AND ts < l.ts) AS min_close_5m,
        (SELECT SUM(volume) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '5 minutes' AND ts < l.ts) AS sum_volume_5m,
        (SELECT AVG(volume) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '5 minutes' AND ts < l.ts) AS avg_volume_5m,
        -- 15 minute lookback
        (SELECT MAX(high) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '15 minutes' AND ts < l.ts) AS max_high_15m,
        (SELECT MIN(low) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '15 minutes' AND ts < l.ts) AS min_low_15m,
        (SELECT MAX(close) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '15 minutes' AND ts < l.ts) AS max_close_15m,
        (SELECT MIN(close) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '15 minutes' AND ts < l.ts) AS min_close_15m,
        (SELECT SUM(volume) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '15 minutes' AND ts < l.ts) AS sum_volume_15m,
        (SELECT AVG(volume) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '15 minutes' AND ts < l.ts) AS avg_volume_15m,
        -- 30 minute lookback
        (SELECT MAX(high) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '30 minutes' AND ts < l.ts) AS max_high_30m,
        (SELECT MIN(low) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '30 minutes' AND ts < l.ts) AS min_low_30m,
        (SELECT MAX(close) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '30 minutes' AND ts < l.ts) AS max_close_30m,
        (SELECT MIN(close) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '30 minutes' AND ts < l.ts) AS min_close_30m,
        (SELECT SUM(volume) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '30 minutes' AND ts < l.ts) AS sum_volume_30m,
        (SELECT AVG(volume) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '30 minutes' AND ts < l.ts) AS avg_volume_30m,
        -- 1 hour lookback
        (SELECT MAX(high) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '1 hour' AND ts < l.ts) AS max_high_1h,
        (SELECT MIN(low) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '1 hour' AND ts < l.ts) AS min_low_1h,
        (SELECT MAX(close) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '1 hour' AND ts < l.ts) AS max_close_1h,
        (SELECT MIN(close) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '1 hour' AND ts < l.ts) AS min_close_1h,
        (SELECT SUM(volume) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '1 hour' AND ts < l.ts) AS sum_volume_1h,
        (SELECT AVG(volume) FROM minute_bars WHERE symbol = l.symbol AND ts >= l.ts - INTERVAL '1 hour' AND ts < l.ts) AS avg_volume_1h
      FROM latest l
    )
    SELECT 
      l.symbol, 
      l.ts, 
      l.price, 
      l.open,
      l.high,
      l.low,
      COALESCE(l.interval_pct, l.daily_pct, 0) AS interval_pct, 
      COALESCE(l.daily_pct, l.interval_pct) AS daily_pct, 
      l.volume, 
      l.value, 
      l.raw,
      d.daily_high,
      d.daily_low,
      d.daily_volume,
      d.daily_value,
      d.daily_open,
      l.prev_close,
      l.prev_open,
      l.prev_high,
      l.prev_low,
      l.prev_volume,
      -- Lookback stats for flexible strategy builder
      lb.max_high_5m, lb.min_low_5m, lb.max_close_5m, lb.min_close_5m, lb.sum_volume_5m, lb.avg_volume_5m,
      lb.max_high_15m, lb.min_low_15m, lb.max_close_15m, lb.min_close_15m, lb.sum_volume_15m, lb.avg_volume_15m,
      lb.max_high_30m, lb.min_low_30m, lb.max_close_30m, lb.min_close_30m, lb.sum_volume_30m, lb.avg_volume_30m,
      lb.max_high_1h, lb.min_low_1h, lb.max_close_1h, lb.min_close_1h, lb.sum_volume_1h, lb.avg_volume_1h
    FROM latest l
    LEFT JOIN daily_24h_stats d ON l.symbol = d.symbol
    LEFT JOIN lookback_stats lb ON l.symbol = lb.symbol
    ORDER BY ${buildOrderClause('pct', favoritesParam)}
    LIMIT ${limitParam};
  `;

  return { sql, params };
};

const aggregateQuery = ({ interval, limit, indices, favorites }) => {
  const params = [];
  let paramIndex = 1;

  // Calculate exact time interval - same real-time approach as 1m but with time-based lookup
  const timeInterval = {
    '5m': "INTERVAL '5 minutes'",
    '15m': "INTERVAL '15 minutes'",
    '1h': "INTERVAL '1 hour'",
    'Day': "INTERVAL '1 day'"
  }[interval] || "INTERVAL '5 minutes'";

  const whereClauses = [];

  // Filter by configured symbols if available (from env var)
  const configuredSymbols = getSymbolsList();
  if (configuredSymbols && configuredSymbols.length > 0) {
    params.push(configuredSymbols);
    whereClauses.push(`symbol = ANY($${paramIndex})`);
    paramIndex += 1;
  }

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

  // Real-time approach: Get latest data, then find data N minutes before
  // This uses the exact same pattern as 1m but with configurable time interval
  // PLUS: Always calculate 24h statistics for the coin modal
  const sql = `
    WITH ranked AS (
      SELECT
        symbol,
        ts,
        close AS price,
        open,
        high,
        low,
        volume,
        value,
        daily_pct,
        raw,
        LAG(close) OVER (PARTITION BY symbol ORDER BY ts) AS prev_close,
        LAG(open) OVER (PARTITION BY symbol ORDER BY ts) AS prev_open,
        LAG(high) OVER (PARTITION BY symbol ORDER BY ts) AS prev_high,
        LAG(low) OVER (PARTITION BY symbol ORDER BY ts) AS prev_low,
        LAG(volume) OVER (PARTITION BY symbol ORDER BY ts) AS prev_volume,
        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY ts DESC) AS rk
      FROM minute_bars
      ${where}
    ),
    latest_data AS (
      -- Get ABSOLUTE latest data point for each symbol (real-time)
      SELECT 
        symbol,
        ts,
        price,
        open,
        high,
        low,
        volume,
        value,
        daily_pct,
        raw,
        prev_close,
        prev_open,
        prev_high,
        prev_low,
        prev_volume
      FROM ranked
      WHERE rk = 1
    ),
    earlier_data AS (
      -- Get data point closest to (latest_ts - interval) for interval percentage
      SELECT DISTINCT ON (l.symbol)
        l.symbol,
        e.close AS earlier_price
      FROM latest_data l
      LEFT JOIN LATERAL (
        SELECT close
        FROM minute_bars
        WHERE symbol = l.symbol
          AND ts <= l.ts - ${timeInterval}
        ORDER BY ts DESC
        LIMIT 1
      ) e ON true
    ),
    daily_24h_stats AS (
      -- Calculate 24h statistics for coin modal (always full day)
      SELECT DISTINCT ON (l.symbol)
        l.symbol,
        (
          SELECT MAX(high) 
          FROM minute_bars 
          WHERE symbol = l.symbol 
            AND ts >= l.ts - INTERVAL '24 hours'
            AND ts <= l.ts
        ) AS daily_high,
        (
          SELECT MIN(low) 
          FROM minute_bars 
          WHERE symbol = l.symbol 
            AND ts >= l.ts - INTERVAL '24 hours'
            AND ts <= l.ts
        ) AS daily_low,
        (
          SELECT SUM(volume) 
          FROM minute_bars 
          WHERE symbol = l.symbol 
            AND ts >= l.ts - INTERVAL '24 hours'
            AND ts <= l.ts
        ) AS daily_volume,
        (
          SELECT SUM(value) 
          FROM minute_bars 
          WHERE symbol = l.symbol 
            AND ts >= l.ts - INTERVAL '24 hours'
            AND ts <= l.ts
        ) AS daily_value,
        (
          SELECT open 
          FROM minute_bars 
          WHERE symbol = l.symbol 
            AND ts >= l.ts - INTERVAL '24 hours'
            AND ts <= l.ts
          ORDER BY ts ASC
          LIMIT 1
        ) AS daily_open
      FROM latest_data l
    ),
    calculated AS (
      -- Calculate interval percentage change (real-time calculation)
      SELECT 
        l.symbol,
        l.ts,
        l.price,
        l.volume,
        l.value,
        l.daily_pct,
        l.raw,
        e.earlier_price,
        d.daily_high,
        d.daily_low,
        d.daily_volume,
        d.daily_value,
        d.daily_open,
        l.prev_close,
        l.prev_open,
        l.prev_high,
        l.prev_low,
        l.prev_volume,
        CASE 
          WHEN e.earlier_price IS NULL OR e.earlier_price = 0 THEN l.daily_pct
          ELSE (l.price - e.earlier_price) / e.earlier_price * 100 
        END AS interval_pct
      FROM latest_data l
      LEFT JOIN earlier_data e ON l.symbol = e.symbol
      LEFT JOIN daily_24h_stats d ON l.symbol = d.symbol
    )
    SELECT 
      symbol,
      ts AS bucket,
      price,
      COALESCE(interval_pct, daily_pct, 0) AS interval_pct,
      daily_pct,
      volume,
      value,
      raw,
      daily_high,
      daily_low,
      daily_volume,
      daily_value,
      daily_open,
      prev_close,
      prev_open,
      prev_high,
      prev_low,
      prev_volume
    FROM calculated
    ORDER BY ${buildOrderClause('pct', favoritesParam)}
    LIMIT ${limitParam};
  `;

  return { sql, params };
};

const hydrateResponse = (rows, interval) => {
  // Get latest data timestamp from rows
  const latestDataTs = rows.length ? rows.reduce((latest, row) => {
    const ts = row.bucket ?? row.ts;
    return ts && ts > latest ? ts : latest;
  }, 0) : null;

  // Use current time as "asOf" to show real-time status
  // If no data, return null
  const asOf = latestDataTs ? new Date().toISOString() : null;

  return {
    interval,
    asOf,
    symbols: rows.map((row) => ({
      symbol: row.symbol,
      price: Number(row.price),
      open: row.open != null ? Number(row.open) : null,
      high: row.high != null ? Number(row.high) : null,
      low: row.low != null ? Number(row.low) : null,
      intervalPct: Number(row.interval_pct ?? 0),
      dailyPct: row.daily_pct != null ? Number(row.daily_pct) : null,
      volume: row.volume != null ? Number(row.volume) : null,
      turnover: row.value != null ? Number(row.value) : null,
      ts: row.bucket ?? row.ts,
      raw: row.raw,
      // Add daily (24h) statistics for coin modal - always calculated regardless of interval
      dailyHigh: row.daily_high != null ? Number(row.daily_high) : null,
      dailyLow: row.daily_low != null ? Number(row.daily_low) : null,
      dailyVolume: row.daily_volume != null ? Number(row.daily_volume) : null,
      dailyValue: row.daily_value != null ? Number(row.daily_value) : null,
      dailyOpen: row.daily_open != null ? Number(row.daily_open) : null,
      // Previous bar data for breakout detection strategies
      prevClose: row.prev_close != null ? Number(row.prev_close) : null,
      prevOpen: row.prev_open != null ? Number(row.prev_open) : null,
      prevHigh: row.prev_high != null ? Number(row.prev_high) : null,
      prevLow: row.prev_low != null ? Number(row.prev_low) : null,
      prevVolume: row.prev_volume != null ? Number(row.prev_volume) : null,
      // Lookback stats for flexible strategy builder
      lookback: {
        // 5 minute
        maxHigh5m: row.max_high_5m != null ? Number(row.max_high_5m) : null,
        minLow5m: row.min_low_5m != null ? Number(row.min_low_5m) : null,
        maxClose5m: row.max_close_5m != null ? Number(row.max_close_5m) : null,
        minClose5m: row.min_close_5m != null ? Number(row.min_close_5m) : null,
        sumVolume5m: row.sum_volume_5m != null ? Number(row.sum_volume_5m) : null,
        avgVolume5m: row.avg_volume_5m != null ? Number(row.avg_volume_5m) : null,
        // 15 minute
        maxHigh15m: row.max_high_15m != null ? Number(row.max_high_15m) : null,
        minLow15m: row.min_low_15m != null ? Number(row.min_low_15m) : null,
        maxClose15m: row.max_close_15m != null ? Number(row.max_close_15m) : null,
        minClose15m: row.min_close_15m != null ? Number(row.min_close_15m) : null,
        sumVolume15m: row.sum_volume_15m != null ? Number(row.sum_volume_15m) : null,
        avgVolume15m: row.avg_volume_15m != null ? Number(row.avg_volume_15m) : null,
        // 30 minute
        maxHigh30m: row.max_high_30m != null ? Number(row.max_high_30m) : null,
        minLow30m: row.min_low_30m != null ? Number(row.min_low_30m) : null,
        maxClose30m: row.max_close_30m != null ? Number(row.max_close_30m) : null,
        minClose30m: row.min_close_30m != null ? Number(row.min_close_30m) : null,
        sumVolume30m: row.sum_volume_30m != null ? Number(row.sum_volume_30m) : null,
        avgVolume30m: row.avg_volume_30m != null ? Number(row.avg_volume_30m) : null,
        // 1 hour
        maxHigh1h: row.max_high_1h != null ? Number(row.max_high_1h) : null,
        minLow1h: row.min_low_1h != null ? Number(row.min_low_1h) : null,
        maxClose1h: row.max_close_1h != null ? Number(row.max_close_1h) : null,
        minClose1h: row.min_close_1h != null ? Number(row.min_close_1h) : null,
        sumVolume1h: row.sum_volume_1h != null ? Number(row.sum_volume_1h) : null,
        avgVolume1h: row.avg_volume_1h != null ? Number(row.avg_volume_1h) : null
      }
    }))
  };
};

router.get('/', async (req, res, next) => {
  let parsed;
  try {
    parsed = schema.parse(req.query);
  } catch (err) {
    res.status(400).json({ error: { code: 'INVALID_PARAMS', message: err.message } });
    return;
  }

  // Skip cache for all intervals to ensure real-time data
  // Cache was causing delayed data for intervals other than 1m
  // const cacheKey = `bubbles:${parsed.interval}:${parsed.limit}:${parsed.indices?.join('|') ?? ''}:${parsed.favorites?.join('|') ?? ''}`;
  // try {
  //   if (parsed.interval !== '1m') {
  //     const cached = await getCache(cacheKey);
  //     if (cached) {
  //       res.set('X-Cache', 'HIT');
  //       res.json(cached);
  //       return;
  //     }
  //   }
  // } catch (err) {
  //   logger.warn({ err }, 'Cache fetch failed');
  // }

  try {
    const queryBuilder = parsed.interval === '1m' ? latestRawQuery : aggregateQuery;
    const { sql, params } = queryBuilder(parsed);

    const rows = await withClient(async (client) => {
      // Debug: Check actual latest timestamp in database
      if (parsed.interval !== '1m') {
        const latestCheck = await client.query(`
          SELECT MAX(ts) as max_ts, COUNT(*) as total_rows 
          FROM minute_bars 
          WHERE ts > NOW() - INTERVAL '1 hour'
        `);
        logger.info({
          interval: parsed.interval,
          dbLatestTs: latestCheck.rows[0]?.max_ts,
          dbRowCount: latestCheck.rows[0]?.total_rows,
          currentTime: new Date().toISOString()
        }, 'Database latest timestamp check');
      }

      const result = await client.query(sql, params);

      // Debug: Log query result timestamps
      if (parsed.interval !== '1m' && result.rows.length > 0) {
        const timestamps = result.rows.map(r => r.bucket ?? r.ts).filter(Boolean).sort((a, b) => new Date(b) - new Date(a));
        const latestTs = timestamps[0];
        logger.info({
          interval: parsed.interval,
          rowCount: result.rows.length,
          queryLatestTimestamp: latestTs,
          sampleSymbols: result.rows.slice(0, 3).map(r => ({ symbol: r.symbol, ts: r.bucket ?? r.ts }))
        }, 'Query result check');
      }

      return result.rows;
    });

    const payload = hydrateResponse(rows, parsed.interval);

    // Skip cache to ensure real-time data for all intervals
    // if (parsed.interval !== '1m') {
    //   await setCache(cacheKey, payload, parsed.interval === 'Day' ? 60 : 15);
    // }

    res.set('X-Cache', 'MISS');
    // Disable ETag and caching for real-time data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.removeHeader('ETag');
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;

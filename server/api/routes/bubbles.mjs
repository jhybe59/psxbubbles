/**
 * Main bubbles endpoint - now powered by QuestDB
 * Uses LATEST ON for instant per-symbol results
 */
import { Router } from 'express';
import { z } from 'zod';
import { queryQuestDB } from '../questdb.mjs';
import { withClient } from '../db.mjs';  // PostgreSQL for static data
import { getCache, setCache } from '../cache.mjs';
import logger from '../logger.mjs';

const router = Router();

// Tick interval pattern: 10t, 100t, 500t, 1000t
const TICK_INTERVALS = ['10t', '100t', '500t', '1000t'];

const schema = z.object({
  interval: z.enum(['1m', '5m', '15m', '1h', 'Day', '10t', '100t', '500t', '1000t']).default('1m'),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
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

/**
 * Get symbols for an index from PostgreSQL
 */
async function getIndexSymbols(indexCodes) {
  if (!indexCodes || indexCodes.length === 0) return null;

  try {
    const placeholders = indexCodes.map((_, i) => `$${i + 1}`).join(',');
    const result = await withClient(async (client) => {
      return client.query(
        `SELECT DISTINCT symbol FROM index_members WHERE index_code IN (${placeholders})`,
        indexCodes.map(c => c.toUpperCase())
      );
    });
    return result.rows.map(r => r.symbol);
  } catch (err) {
    logger.warn({ err }, 'Failed to get index symbols from PostgreSQL');
    return null;
  }
}

/**
 * Build LATEST ON query for real-time data (1m interval)
 */
function buildLatestQuery(symbols = null) {
  let sql = `
    SELECT 
      symbol,
      timestamp as ts,
      open,
      high,
      low,
      close,
      volume,
      value,
      daily_pct
    FROM minute_bars
    LATEST ON timestamp PARTITION BY symbol
  `;

  if (symbols && symbols.length > 0) {
    const symbolList = symbols.map(s => `'${s}'`).join(',');
    sql += ` WHERE symbol IN (${symbolList})`;
  }

  return sql;
}

/**
 * Build aggregated query for all intervals using real-time approach
 * Uses LATEST ON for current prices (like 1m), then calculates OHLCV from lookback window
 * This ensures all intervals get fresh data on every refresh
 */
function buildAggregatedQuery(interval, symbols = null) {
  // Map interval to minutes for lookback window
  const minutesMap = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    'Day': 480  // ~8 hours trading session
  };

  const minutes = minutesMap[interval] || 5;

  // Use subqueries to get:
  // 1. Latest row per symbol (for current close price)
  // 2. Aggregates (high, low, volume) from the lookback window
  // 3. First row in window (for open price)
  let symbolFilter = '';
  if (symbols && symbols.length > 0) {
    const symbolList = symbols.map(s => `'${s}'`).join(',');
    symbolFilter = ` AND symbol IN (${symbolList})`;
  }

  // Get the latest data per symbol using LATEST ON (same as 1m - always fresh)
  // Then also compute aggregates from the lookback window
  let sql = `
    WITH latest AS (
      SELECT symbol, timestamp as ts, close, daily_pct
      FROM minute_bars
      LATEST ON timestamp PARTITION BY symbol
    ),
    window_agg AS (
      SELECT 
        symbol,
        first(close) as first_open,
        max(high) as high,
        min(low) as low,
        sum(volume) as volume,
        sum(value) as value
      FROM minute_bars
      WHERE timestamp > dateadd('m', -${minutes}, now())${symbolFilter}
      GROUP BY symbol
    )
    SELECT 
      l.symbol,
      l.ts,
      COALESCE(w.first_open, l.close) as open,
      COALESCE(w.high, l.close) as high,
      COALESCE(w.low, l.close) as low,
      l.close,
      COALESCE(w.volume, 0) as volume,
      COALESCE(w.value, 0) as value,
      l.daily_pct
    FROM latest l
    LEFT JOIN window_agg w ON l.symbol = w.symbol
  `;

  if (symbols && symbols.length > 0) {
    const symbolList = symbols.map(s => `'${s}'`).join(',');
    sql += ` WHERE l.symbol IN (${symbolList})`;
  }

  return sql;
}

/**
 * Check if an interval is tick-based
 */
function isTickInterval(interval) {
  return TICK_INTERVALS.includes(interval);
}

/**
 * Build tick-based aggregation query
 * Groups ticks by symbol and tick_seq bucket (e.g., every 100 ticks)
 */
function buildTickQuery(interval, symbols = null) {
  // Extract tick size from interval (e.g., '100t' -> 100)
  const tickSize = parseInt(interval.replace('t', ''), 10);

  // Use subquery with tick bucket calculation
  // QuestDB doesn't have modulo in GROUP BY, so we use WHERE to get latest ticks
  // and then group by bucket computed via floor division
  let sql = `
    WITH latest_ticks AS (
      SELECT 
        symbol,
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        value,
        daily_pct,
        tick_seq,
        (tick_seq / ${tickSize}) as tick_bucket
      FROM minute_bars
      WHERE timestamp > dateadd('h', -24, now())
    )
    SELECT 
      symbol,
      max(timestamp) as ts,
      first(close) as open,
      max(high) as high,
      min(low) as low,
      last(close) as close,
      sum(volume) as volume,
      sum(value) as value,
      last(daily_pct) as daily_pct,
      max(tick_seq) as tick_seq
    FROM latest_ticks
  `;

  if (symbols && symbols.length > 0) {
    const symbolList = symbols.map(s => `'${s}'`).join(',');
    sql += ` WHERE symbol IN (${symbolList})`;
  }

  sql += ` GROUP BY symbol, tick_bucket`;
  sql += ` ORDER BY symbol, tick_bucket DESC`;

  return sql;
}

/**
 * Transform QuestDB response to API format
 */
function transformResponse(result, interval, favorites = []) {
  if (!result || !result.dataset) {
    return { meta: { count: 0, interval }, data: [] };
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

    // For aggregated queries we might have multiple rows per symbol
    // Only keep the latest (first encountered due to ORDER BY ts DESC)
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
        ts: typeof ts === 'string' ? ts : new Date(ts).toISOString(),
        isFavorite: favorites.includes(symbol)
      });
    }
  }

  // Convert to array and sort
  let data = Array.from(symbolMap.values());

  // Sort: favorites first, then by pct_interval
  data.sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return (b.pct_interval || 0) - (a.pct_interval || 0);
  });

  return {
    meta: {
      count: data.length,
      interval,
      source: 'questdb',
      ts: new Date().toISOString()
    },
    data
  };
}

router.get('/', async (req, res) => {
  const start = Date.now();

  try {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid parameters', details: parsed.error.errors });
    }

    const { interval, limit, indices, favorites } = parsed.data;

    // Get symbols to filter by
    let symbols = null;

    // Get symbols from index if specified (from PostgreSQL)
    if (indices && indices.length > 0) {
      symbols = await getIndexSymbols(indices);
    }

    // Add favorites to symbols list
    if (favorites && favorites.length > 0) {
      if (symbols) {
        symbols = [...new Set([...symbols, ...favorites])];
      } else {
        symbols = favorites;
      }
    }

    // Build and execute QuestDB query
    let sql;
    if (isTickInterval(interval)) {
      sql = buildTickQuery(interval, symbols);
    } else {
      sql = buildAggregatedQuery(interval, symbols);
    }

    console.log('[DEBUG] Bubbles SQL:', sql.replace(/\s+/g, ' ').trim());


    const result = await queryQuestDB(sql);
    const payload = transformResponse(result, interval, favorites || []);

    // Apply limit
    if (payload.data.length > limit) {
      payload.data = payload.data.slice(0, limit);
      payload.meta.count = payload.data.length;
    }

    const duration = Date.now() - start;
    logger.debug({ duration, count: payload.data.length, interval }, 'QuestDB bubbles query');

    // Disable caching for real-time data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('X-Response-Time', `${duration}ms`);
    res.set('X-Database', 'questdb');

    res.json(payload);
  } catch (err) {
    logger.error({ err }, 'Bubbles endpoint error');
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

export default router;

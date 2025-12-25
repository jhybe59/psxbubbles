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
import rvolService from '../services/rvol-service.mjs';
import { volatilityService } from '../services/volatility-service.mjs';
import alertsService from '../services/alerts-service.mjs';

const router = Router();

// Tick interval pattern: 10t, 20t, 50t, 100t, 500t, 1000t
const TICK_INTERVALS = ['10t', '20t', '50t', '100t', '500t', '1000t'];

const schema = z.object({
  interval: z.enum(['1m', '5m', '15m', '1h', 'Day', '10t', '20t', '50t', '100t', '500t', '1000t']).default('1m'),
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
 * Get ORB (Opening Range Breakout) data for all symbols
 * Uses market-wide first tick as ORB start time
 * Returns ORB high/low for 5m, 15m, 30m windows
 */
async function getORBData(latestTs) {
  try {
    const anchor = latestTs ? `'${latestTs}'::timestamp` : 'now()';
    // Step 1: Get market-wide first tick of the trading day
    // Pakistan trading day starts at 09:00 PKT = 04:00 UTC
    // We find today's first tick after 04:00 UTC
    const marketOpenSql = `
      SELECT MIN(timestamp) as first_tick
      FROM trades
      WHERE timestamp >= dateadd('h', 4, date_trunc('day', ${anchor}))
    `;

    const marketOpenResult = await queryQuestDB(marketOpenSql);

    if (!marketOpenResult || !marketOpenResult.dataset ||
      marketOpenResult.dataset.length === 0 || !marketOpenResult.dataset[0][0]) {
      return new Map(); // No trades today
    }

    const firstTick = marketOpenResult.dataset[0][0];

    // Step 2: Calculate ORB for all windows (5m, 15m, 30m) in one query
    const orbSql = `
      SELECT 
        symbol,
        MAX(CASE WHEN timestamp < dateadd('m', 5, '${firstTick}') THEN price END) as orb_high_5m,
        MIN(CASE WHEN timestamp < dateadd('m', 5, '${firstTick}') THEN price END) as orb_low_5m,
        MAX(CASE WHEN timestamp < dateadd('m', 15, '${firstTick}') THEN price END) as orb_high_15m,
        MIN(CASE WHEN timestamp < dateadd('m', 15, '${firstTick}') THEN price END) as orb_low_15m,
        MAX(CASE WHEN timestamp < dateadd('m', 30, '${firstTick}') THEN price END) as orb_high_30m,
        MIN(CASE WHEN timestamp < dateadd('m', 30, '${firstTick}') THEN price END) as orb_low_30m
      FROM trades
      WHERE timestamp >= '${firstTick}'
        AND timestamp < dateadd('m', 30, '${firstTick}')
      GROUP BY symbol
    `;

    const orbResult = await queryQuestDB(orbSql);

    if (!orbResult || !orbResult.dataset) {
      return new Map();
    }

    // Build ORB map by symbol
    const orbMap = new Map();
    const columns = orbResult.columns || [];
    const colIndex = {};
    columns.forEach((col, idx) => {
      colIndex[col.name] = idx;
    });

    for (const row of orbResult.dataset) {
      const symbol = row[colIndex['symbol']];
      orbMap.set(symbol, {
        orb_high_5m: parseFloat(row[colIndex['orb_high_5m']]) || null,
        orb_low_5m: parseFloat(row[colIndex['orb_low_5m']]) || null,
        orb_high_15m: parseFloat(row[colIndex['orb_high_15m']]) || null,
        orb_low_15m: parseFloat(row[colIndex['orb_low_15m']]) || null,
        orb_high_30m: parseFloat(row[colIndex['orb_high_30m']]) || null,
        orb_low_30m: parseFloat(row[colIndex['orb_low_30m']]) || null
      });
    }

    logger.debug({ count: orbMap.size, firstTick }, 'ORB data calculated');
    return orbMap;
  } catch (err) {
    logger.warn({ err }, 'Failed to calculate ORB data');
    return new Map();
  }
}

/**
 * Build LATEST ON query for real-time data (1m interval)
 */
function buildLatestQuery(symbols = null) {
  let symbolFilter = '';
  if (symbols && symbols.length > 0) {
    const symbolList = symbols.map(s => `'${s}'`).join(',');
    symbolFilter = ` AND symbol IN (${symbolList})`;
  }

  // Calculate daily_pct dynamically because 'trades' table likely lacks it
  let sql = `
    WITH latest_1m AS (
      SELECT 
        symbol,
        timestamp as ts,
        first(price) as open,
        max(price) as high,
        min(price) as low,
        last(price) as close,
        sum(volume) as volume,
        sum(value) as value
      FROM trades
      WHERE timestamp >= dateadd('d', -1, now()) 
      ${symbolFilter}
      SAMPLE BY 1m ALIGN TO CALENDAR
    ),
    latest_final AS (
      SELECT * FROM latest_1m LATEST ON ts PARTITION BY symbol
    ),
    prev_day AS (
       -- Get last price before today's open (04:00 UTC)
       SELECT symbol, close as prev_close
       FROM (
         SELECT symbol, last(price) as close, timestamp
         FROM trades
         WHERE timestamp < dateadd('h', 4, date_trunc('day', now()))
           AND timestamp >= dateadd('d', -7, dateadd('h', 4, date_trunc('day', now())))
           ${symbolFilter}
         SAMPLE BY 1m ALIGN TO CALENDAR
       ) LATEST ON timestamp PARTITION BY symbol
    )
    SELECT 
      l.symbol,
      l.ts,
      l.open,
      l.high,
      l.low,
      l.close,
      l.volume,
      l.value,
      0 as daily_pct
    FROM latest_final l
    -- LEFT JOIN prev_day p ON l.symbol = p.symbol -- DISABLED FOR STABILITY
  `;

  return sql;
}

/**
 * Build aggregated query for all intervals using real-time approach
 * Uses LATEST ON for current prices (like 1m), then calculates OHLCV from lookback window
 * This ensures all intervals get fresh data on every refresh
 */
function buildAggregatedQuery(interval, latestTs, symbols = null) {
  // Map interval to minutes for lookback window
  const minutesMap = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    // 'Day' is handled specially now
  };

  const minutes = minutesMap[interval] || 5;
  const isDay = interval === 'Day';

  // QuestDB timestamp precision is microseconds (6 digits). 
  // Truncate incoming 9-digit (nano) strings to avoid parsing errors.
  const anchorTs = typeof latestTs === 'string' && latestTs.includes('.')
    ? latestTs.split('.')[0] + '.' + latestTs.split('.')[1].substring(0, 6) + 'Z'
    : latestTs;

  // Use subqueries to get:
  // 1. Latest row per symbol (for current close price)
  // 2. Aggregates (high, low, volume) from the lookback window
  // 3. First row in window (for open price)
  let symbolFilter = '';
  if (symbols && symbols.length > 0) {
    const symbolList = symbols.map(s => `'${s}'`).join(',');
    symbolFilter = ` AND symbol IN (${symbolList})`;
  }

  // Pakistan trading day starts at 09:00 PKT = 04:00 UTC
  // Use a data-relative anchor for time intervals to avoid 0.0% when market is closed
  // ROBUST: Calculate "Today Open" relative to the latest data timestamp, not NOW
  // This ensures that during weekends, "Today" refers to the last trading day.
  const todayOpen = `dateadd('h', 4, date_trunc('day', '${anchorTs}'::timestamp))`;

  const timeCondition = isDay
    ? `timestamp >= ${todayOpen}`
    : `timestamp > dateadd('m', -${minutes}, '${anchorTs}'::timestamp)`;

  // Get the latest data per symbol using LATEST ON (same as 1m - always fresh)
  // Then also compute aggregates from the lookback window
  let sql = `
    WITH day_vols AS (
      SELECT symbol, sum(volume) as day_volume
      FROM trades
      WHERE timestamp >= ${todayOpen}
      GROUP BY symbol
    ),
    prev_day_stats AS (
      -- ROBUST: Find the last known close BEFORE today's session open
      -- Using subquery pattern as QuestDB doesn't allow WHERE before LATEST ON
      SELECT symbol, close as prev_close, high as prev_high
      FROM (
        SELECT symbol, last(price) as close, max(price) as high, timestamp
        FROM trades
        WHERE timestamp < ${todayOpen}
          AND timestamp >= dateadd('d', -7, ${todayOpen})
          ${symbolFilter.replace('WHERE', 'AND')}
        SAMPLE BY 1m ALIGN TO CALENDAR
      ) LATEST ON timestamp PARTITION BY symbol
    ),
    day_agg AS (
      SELECT 
        symbol,
        max(price) as day_high,
        min(price) as day_low
      FROM trades
      WHERE timestamp >= ${todayOpen}
      GROUP BY symbol
    ),
    window_agg AS (
      SELECT 
        symbol,
        first(price) as first_open,
        max(price) as high,
        min(price) as low,
        sum(volume) as volume,
        sum(value) as value
      FROM trades
      WHERE ${timeCondition}
        ${symbolFilter.replace('WHERE', 'AND')}
      GROUP BY symbol
    ),
    latest_l AS (
      SELECT symbol, timestamp as ts, last(price) as close
      FROM trades
      WHERE timestamp >= dateadd('d', -7, '${anchorTs}'::timestamp) 
      ${symbolFilter.replace('WHERE', 'AND')}
      SAMPLE BY 1m ALIGN TO CALENDAR
    ),
    latest_ordered AS (
      SELECT * FROM latest_l LATEST ON ts PARTITION BY symbol
    ),
    baseline_b AS (
      SELECT symbol, timestamp, last(price) as baseline_close
      FROM trades
      WHERE timestamp <= dateadd('m', -${minutes}, '${anchorTs}'::timestamp)
        AND timestamp >= dateadd('d', -7, '${anchorTs}'::timestamp)
        ${symbolFilter.replace('WHERE', 'AND')}
      SAMPLE BY 1m ALIGN TO CALENDAR
    ),
    baseline_ordered AS (
      SELECT * FROM baseline_b LATEST ON timestamp PARTITION BY symbol
    )
    SELECT 
      l.symbol,
      l.ts,
      COALESCE(b.baseline_close, w.first_open, l.close) as open,
      GREATEST(COALESCE(w.high, l.close), l.close) as high,
      LEAST(COALESCE(w.low, l.close), l.close) as low,
      l.close,
      COALESCE(w.volume, 0) as volume,
      COALESCE(w.value, 0) as value,
      0 as daily_pct,
      COALESCE(dv.day_volume, 0) as day_volume,
      0 as prev_high,
      0 as prev_close,
      da.day_high,
      da.day_low
    FROM latest_ordered l
    LEFT JOIN window_agg w ON l.symbol = w.symbol
    LEFT JOIN baseline_ordered b ON l.symbol = b.symbol
    LEFT JOIN day_vols dv ON l.symbol = dv.symbol
    -- LEFT JOIN prev_day_stats pds ON l.symbol = pds.symbol -- DISABLED FOR STABILITY
    LEFT JOIN day_agg da ON l.symbol = da.symbol
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
function buildTickQuery(interval, latestTs, symbols = null) {
  // Extract tick size from interval (e.g., '100t' -> 100)
  const tickSize = parseInt(interval.replace('t', ''), 10);

  // Use subquery with tick bucket calculation
  // QuestDB doesn't have modulo in GROUP BY, so we use WHERE to get latest ticks
  // and then group by bucket computed via floor division
  let sql = `
    WITH latest_ticks AS(
    SELECT 
        symbol,
        timestamp,
        price as open,
        price as high,
        price as low,
        price as close,
        volume,
        value,
        tick_seq,
        (tick_seq / ${tickSize}) as tick_bucket
      FROM trades
      WHERE timestamp > dateadd('h', -168, '${latestTs}'::timestamp)
      AND volume > 0
      ${symbols && symbols.length > 0 ? `AND symbol IN (${symbols.map(s => `'${s}'`).join(',')})` : ''}
    ),
    day_vols AS(
      --Get total SESSION volume from trades(raw tick data)
      --Session starts at 09:00 PKT = 04:00 UTC
      SELECT symbol, sum(volume) as day_volume
      FROM trades
      WHERE timestamp >= dateadd('h', 4, date_trunc('day', '${latestTs}'::timestamp))
      GROUP BY symbol
    ),
    prev_day_stats AS (
      -- ROBUST: Find the last known close BEFORE today's session open
      SELECT symbol, last(price) as prev_close, max(price) as prev_high
      FROM trades
      WHERE timestamp < dateadd('h', 4, date_trunc('day', '${latestTs}'::timestamp))
        AND timestamp >= dateadd('d', -7, dateadd('h', 4, date_trunc('day', '${latestTs}'::timestamp)))
        ${symbols && symbols.length > 0 ? `AND symbol IN (${symbols.map(s => `'${s}'`).join(',')})` : ''}
      SAMPLE BY 1m ALIGN TO CALENDAR
      LATEST ON timestamp PARTITION BY symbol
    )
    SELECT
      l.symbol,
      max(l.timestamp) as ts,
      first(l.open) as open,
      max(l.high) as high,
      min(l.low) as low,
      last(l.close) as close,
      sum(l.volume) as volume,
      sum(l.value) as value,
      0 as daily_pct,
      max(l.tick_seq) as tick_seq,
      COALESCE(first(dv.day_volume), 0) as day_volume,
      0 as prev_high,
      0 as prev_close
    FROM latest_ticks l
    LEFT JOIN day_vols dv ON l.symbol = dv.symbol
    -- LEFT JOIN prev_day_stats pds ON l.symbol = pds.symbol -- DISABLED

    GROUP BY l.symbol, l.tick_bucket
    ORDER BY l.symbol, l.tick_bucket DESC
  `;

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
      let dayVolume = parseFloat(row[colIndex['day_volume']]) || 0;
      const prevHigh = parseFloat(row[colIndex['prev_high']]) || null;
      const prevClose = parseFloat(row[colIndex['prev_close']]) || null;
      const dayHigh = parseFloat(row[colIndex['day_high']]) || null;
      const dayLow = parseFloat(row[colIndex['day_low']]) || null;

      // Calculate interval percentage change
      let intervalPct = 0;
      if (interval === 'Day' && prevClose) {
        // PSX Terminal standard: (Close - PrevDayClose) / PrevDayClose
        intervalPct = ((close - prevClose) / prevClose) * 100;
      } else {
        // Other intervals or fallback if no prevClose
        intervalPct = open !== 0 ? ((close - open) / open) * 100 : 0;
      }

      // Calculate Day Percentage reliably (PSX Standard)
      // If interval is Day, use calculated intervalPct. Otherwise, use prevClose if available.
      const calcDayPct = prevClose ? ((close - prevClose) / prevClose) * 100 : dailyPct;
      const finalDailyPct = (interval === 'Day') ? intervalPct : calcDayPct;

      symbolMap.set(symbol, {
        symbol,
        price: close,
        open,
        high,
        low,
        close,
        volume,
        value,
        pct_24h: finalDailyPct,
        pct_interval: intervalPct,
        interval,
        day_volume: dayVolume,
        prev_high: prevHigh,
        prev_close: prevClose,
        day_high: dayHigh,
        day_low: dayLow,
        ts: typeof ts === 'string' ? ts : new Date(ts).toISOString(),
        isFavorite: favorites.includes(symbol),
        rvol: 0 // Placeholder, will be merged later
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
  let sql = null;

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

    // Get latest timestamp from DB to use as anchor (USE TRADES since minute_bars was removed)
    const anchorRes = await queryQuestDB("SELECT MAX(timestamp) FROM trades");
    let latestTs = new Date().toISOString();
    if (anchorRes && anchorRes.dataset && anchorRes.dataset.length > 0 && anchorRes.dataset[0][0]) {
      latestTs = anchorRes.dataset[0][0];
    }

    // Build and execute QuestDB query
    if (isTickInterval(interval)) {
      sql = buildTickQuery(interval, latestTs, symbols);
    } else {
      sql = buildAggregatedQuery(interval, latestTs, symbols);
    }

    // Calculate day start for alerts (09:00 PKT = 04:00 UTC)
    const datePart = latestTs.split('T')[0];
    const dayStart = `${datePart}T04:00:00.000000Z`;

    // Execute queries in parallel for maximum speed
    const [dbResult, rvolMap, orbMap, squeezeMap] = await Promise.all([
      queryQuestDB(sql),
      rvolService.getBatchRVOL(symbols, interval, 20, latestTs),
      getORBData(latestTs),
      (!isTickInterval(interval))
        ? volatilityService.getBatchSqueezeState(symbols, interval === 'Day' ? '1d' : interval, 20, 2.0, 1.5, latestTs)
        : Promise.resolve(new Map())
    ]);

    const payload = transformResponse(dbResult, interval, favorites || []);

    // Merge RVOL data
    for (const bubble of payload.data) {
      bubble.rvol = rvolMap.get(bubble.symbol) || 0;
    }

    // Merge ORB data
    if (orbMap.size > 0) {
      for (const bubble of payload.data) {
        const orbData = orbMap.get(bubble.symbol);
        if (orbData) {
          bubble.orb_high_5m = orbData.orb_high_5m;
          bubble.orb_low_5m = orbData.orb_low_5m;
          bubble.orb_high_15m = orbData.orb_high_15m;
          bubble.orb_low_15m = orbData.orb_low_15m;
          bubble.orb_high_30m = orbData.orb_high_30m;
          bubble.orb_low_30m = orbData.orb_low_30m;

          const price = bubble.price;
          bubble.orb_breakout_5m = price > orbData.orb_high_5m ? 'above' : (price < orbData.orb_low_5m ? 'below' : 'inside');
          bubble.orb_breakout_15m = price > orbData.orb_high_15m ? 'above' : (price < orbData.orb_low_15m ? 'below' : 'inside');
          bubble.orb_breakout_30m = price > orbData.orb_high_30m ? 'above' : (price < orbData.orb_low_30m ? 'below' : 'inside');
        }
      }
      payload.meta.hasORB = true;
    }

    // Merge Volatility Data
    for (const bubble of payload.data) {
      const volData = squeezeMap.get(bubble.symbol);
      if (volData) {
        bubble.squeeze_on = volData.squeeze_on;
        bubble.bb_width = volData.bb_width;
        bubble.kc_width = volData.kc_width;
        bubble.vol_atr = volData.atr;
        bubble.vol_atr_pct = volData.vol_atr_pct;
        bubble.vol_stddev = volData.stddev;
      }
    }

    // Fetch and Merge Alerts (run after we have orbMap for context)
    // Build prevDayMap from payload for alerts service
    const prevDayMap = new Map();
    for (const bubble of payload.data) {
      if (bubble.prev_high || bubble.prev_close) {
        prevDayMap.set(bubble.symbol, { prev_high: bubble.prev_high, prev_low: bubble.prev_close });
      }
    }

    try {
      const symbolsList = payload.data.map(b => b.symbol);
      const alertsMap = await alertsService.getSessionAlerts(symbolsList, dayStart, orbMap, prevDayMap);
      for (const bubble of payload.data) {
        bubble.alerts = alertsMap.get(bubble.symbol) || [];
      }
      payload.meta.hasAlerts = true;
    } catch (alertsErr) {
      logger.warn({ alertsErr }, 'Failed to fetch session alerts');
    }

    // ═══════════════════════════════════════════════════════════════════
    // BREAKOUT DETECTION - TTM Squeeze Strategy (DUAL RVOL)
    // Conditions:
    //   1. squeeze_on = false (volatility expanding)
    //   2. bb_width > kc_width (Bollinger outside Keltner)
    //   3. RVOL check (EITHER rolling OR session-based):
    //      - Rolling RVOL >= 1.5 (current vs last 20 bars avg)
    //      - Session RVOL >= 1.5 (current vs first 5m bar of day)
    //   4. price > orb_high_5m (above ORB resistance)
    //   5. pct_interval > 0 (current move is UP)
    // ═══════════════════════════════════════════════════════════════════
    for (const bubble of payload.data) {
      // Check Rolling RVOL (current method, threshold lowered to 1.5)
      const rollingRvol = bubble.rvol || bubble.relative_volume || 0;
      const hasRollingRvol = rollingRvol >= 1.5;

      // Check Session-based RVOL (vs orb_volume_5m from first 5 min)
      const orbVol5m = bubble.orb_volume_5m || 0;
      const currentVol = bubble.volume || bubble.day_volume || 0;
      const sessionRvol = orbVol5m > 0 ? (currentVol / orbVol5m) : 0;
      const hasSessionRvol = sessionRvol >= 1.5;

      // Breakout requires EITHER rolling OR session RVOL signal
      const hasVolumeSignal = hasRollingRvol || hasSessionRvol;

      const isBreakout = (
        bubble.squeeze_on === false &&
        bubble.bb_width != null && bubble.kc_width != null &&
        bubble.bb_width > bubble.kc_width &&
        hasVolumeSignal &&
        bubble.orb_high_5m != null && bubble.price > bubble.orb_high_5m &&
        bubble.pct_interval > 0
      );

      bubble.breakout_signal = isBreakout;
      bubble.breakout_type = isBreakout ? 'TTM_SQUEEZE' : null;
      // Add RVOL details for debugging
      bubble.breakout_rvol_rolling = rollingRvol;
      bubble.breakout_rvol_session = sessionRvol;
      bubble.breakout_rvol_source = isBreakout ? (hasRollingRvol ? 'ROLLING' : 'SESSION') : null;

      // Add breakout alert if detected
      if (isBreakout) {
        const breakoutAlert = {
          type: 'BREAKOUT',
          label: '🚀 BREAKOUT',
          message: `${bubble.symbol} TTM Squeeze breakout @ ${bubble.price?.toFixed(2)}`,
          rvol: Math.max(rollingRvol, sessionRvol),
          rvol_source: hasRollingRvol ? 'ROLLING' : 'SESSION',
          price: bubble.price,
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
        };
        if (!bubble.alerts) bubble.alerts = [];
        // Only add if not already present (avoid duplicates on refresh)
        if (!bubble.alerts.some(a => a.type === 'BREAKOUT')) {
          bubble.alerts.unshift(breakoutAlert);
        }
        // logger.info({ symbol: bubble.symbol, price: bubble.price, rvol: Math.max(rollingRvol, sessionRvol), source: hasRollingRvol ? 'ROLLING' : 'SESSION' }, 'BREAKOUT DETECTED');
      }
    }

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
    res.set('X-Response-Time', `${duration} ms`);
    res.set('X-Database', 'questdb');

    res.json(payload);
  } catch (err) {
    logger.error({ err }, 'Bubbles endpoint error');
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

export default router;

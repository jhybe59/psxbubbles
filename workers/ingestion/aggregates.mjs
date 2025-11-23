import pg from 'pg';
import { config } from './config.mjs';
import logger from './logger.mjs';

const { Pool } = pg;

const pool = new Pool({
  host: config.timescale.host,
  port: config.timescale.port,
  database: config.timescale.database,
  user: config.timescale.user,
  password: config.timescale.password,
  ssl: config.timescale.ssl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000
});

// Interval configurations
const INTERVAL_CONFIGS = {
  '5m': {
    viewName: 'minute_bars_5m',
    bucketInterval: '5 minutes',
    description: '5-minute candles'
  },
  '15m': {
    viewName: 'minute_bars_15m',
    bucketInterval: '15 minutes',
    description: '15-minute candles'
  },
  '1h': {
    viewName: 'minute_bars_1h',
    bucketInterval: '1 hour',
    description: '1-hour candles'
  },
  '4h': {
    viewName: 'minute_bars_4h',
    bucketInterval: '4 hours',
    description: '4-hour candles'
  },
  '1d': {
    viewName: 'minute_bars_1d',
    bucketInterval: '1 day',
    description: 'Daily candles'
  },
  '1w': {
    viewName: 'minute_bars_1w',
    bucketInterval: '1 week',
    description: 'Weekly candles'
  },
  '1mo': {
    viewName: 'minute_bars_1mo',
    bucketInterval: '1 month',
    description: 'Monthly candles'
  },
  '1y': {
    viewName: 'minute_bars_1y',
    bucketInterval: '1 year',
    description: 'Yearly candles'
  }
};

/**
 * Get aggregated candle data for a specific interval
 * @param {string} interval - One of: '5m', '15m', '1h', '4h', '1d', '1w', '1mo', '1y'
 * @param {Object} options - Query options
 * @param {string|string[]} options.symbols - Symbol(s) to query
 * @param {Date|string} options.startTime - Start time (inclusive)
 * @param {Date|string} options.endTime - End time (inclusive)
 * @param {number} options.limit - Maximum number of rows to return (default: 1000)
 * @param {boolean} options.desc - Order by time descending (default: true)
 * @returns {Promise<Array>} Array of candle objects
 */
export const getAggregatedBars = async (interval, options = {}) => {
  const intervalConfig = INTERVAL_CONFIGS[interval];
  if (!intervalConfig) {
    throw new Error(`Invalid interval: ${interval}. Supported: ${Object.keys(INTERVAL_CONFIGS).join(', ')}`);
  }

  const {
    symbols = null,
    startTime = null,
    endTime = null,
    limit = 1000,
    desc = true
  } = options;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (symbols) {
    const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
    conditions.push(`symbol = ANY($${paramIndex}::text[])`);
    params.push(symbolArray);
    paramIndex += 1;
  }

  if (startTime) {
    conditions.push(`bucket >= $${paramIndex}`);
    params.push(startTime instanceof Date ? startTime : new Date(startTime));
    paramIndex += 1;
  }

  if (endTime) {
    conditions.push(`bucket <= $${paramIndex}`);
    params.push(endTime instanceof Date ? endTime : new Date(endTime));
    paramIndex += 1;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderClause = desc ? 'ORDER BY bucket DESC' : 'ORDER BY bucket ASC';
  const limitClause = limit > 0 ? `LIMIT $${paramIndex}` : '';
  if (limit > 0) {
    params.push(limit);
  }

  const query = `
    SELECT 
      symbol,
      bucket AS ts,
      open,
      high,
      low,
      close,
      volume_sum AS volume,
      turnover_sum AS turnover,
      pct_change AS intervalPct,
      daily_pct
    FROM ${intervalConfig.viewName}
    ${whereClause}
    ${orderClause}
    ${limitClause}
  `;

  try {
    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
      symbol: row.symbol,
      ts: row.ts,
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume || 0),
      turnover: row.turnover ? parseFloat(row.turnover) : null,
      intervalPct: row.intervalpct ? parseFloat(row.intervalpct) : null,
      dailyPct: row.daily_pct ? parseFloat(row.daily_pct) : null
    }));
  } catch (err) {
    logger.error({ err, interval, options }, 'Failed to fetch aggregated bars');
    throw err;
  }
};

/**
 * Get the latest aggregated bar for a symbol(s)
 * @param {string} interval - Interval identifier
 * @param {string|string[]} symbols - Symbol(s) to query
 * @returns {Promise<Object|Array>} Latest candle(s)
 */
export const getLatestBar = async (interval, symbols) => {
  const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
  const bars = await getAggregatedBars(interval, {
    symbols: symbolArray,
    limit: symbolArray.length
  });

  return Array.isArray(symbols) ? bars : bars[0] || null;
};

/**
 * Get aggregated bars for multiple symbols within a time range
 * @param {string} interval - Interval identifier
 * @param {string[]} symbols - Array of symbols
 * @param {Date|string} startTime - Start time
 * @param {Date|string} endTime - End time
 * @returns {Promise<Object>} Object keyed by symbol, containing arrays of candles
 */
export const getBarsBySymbols = async (interval, symbols, startTime, endTime) => {
  const bars = await getAggregatedBars(interval, {
    symbols,
    startTime,
    endTime,
    limit: 0 // No limit for multi-symbol queries
  });

  // Group by symbol
  const result = {};
  symbols.forEach((symbol) => {
    result[symbol] = [];
  });

  bars.forEach((bar) => {
    if (!result[bar.symbol]) {
      result[bar.symbol] = [];
    }
    result[bar.symbol].push(bar);
  });

  return result;
};

/**
 * Refresh a continuous aggregate manually
 * @param {string} interval - Interval identifier
 * @param {Date|string} startTime - Start time for refresh (optional)
 * @param {Date|string} endTime - End time for refresh (optional)
 * @returns {Promise<void>}
 */
export const refreshAggregate = async (interval, startTime = null, endTime = null) => {
  const intervalConfig = INTERVAL_CONFIGS[interval];
  if (!intervalConfig) {
    throw new Error(`Invalid interval: ${interval}`);
  }

  try {
    if (startTime && endTime) {
      const start = startTime instanceof Date ? startTime : new Date(startTime);
      const end = endTime instanceof Date ? endTime : new Date(endTime);
      // Use CALL with proper SQL syntax
      const query = `CALL refresh_continuous_aggregate($1::regclass, $2, $3)`;
      await pool.query(query, [intervalConfig.viewName, start, end]);
    } else {
      // Refresh the entire aggregate (no time bounds)
      // For manual refresh of entire view, we can use a simple SELECT to trigger refresh
      // or use refresh_continuous_aggregate with NULL bounds
      const query = `CALL refresh_continuous_aggregate($1::regclass, NULL, NULL)`;
      await pool.query(query, [intervalConfig.viewName]);
    }
    logger.info({ interval, viewName: intervalConfig.viewName, startTime, endTime }, 'Refreshed continuous aggregate');
  } catch (err) {
    logger.error({ err, interval, viewName: intervalConfig.viewName }, 'Failed to refresh continuous aggregate');
    throw err;
  }
};

/**
 * Get aggregate statistics and status
 * @param {string} interval - Interval identifier (optional, if null returns all)
 * @returns {Promise<Object>} Aggregate status information
 */
export const getAggregateStatus = async (interval = null) => {
  const intervals = interval ? [interval] : Object.keys(INTERVAL_CONFIGS);
  const status = {};

  for (const ivl of intervals) {
    const config = INTERVAL_CONFIGS[ivl];
    try {
      // Get continuous aggregate info from TimescaleDB
      const query = `
        SELECT 
          view_name,
          materialized_only,
          finalized,
          view_definition
        FROM timescaledb_information.continuous_aggregates
        WHERE view_name = $1
      `;
      const result = await pool.query(query, [config.viewName]);

      // Get row count
      const countQuery = `SELECT COUNT(*) as count FROM ${config.viewName}`;
      const countResult = await pool.query(countQuery);

      // Get latest bucket
      const latestQuery = `SELECT MAX(bucket) as latest FROM ${config.viewName}`;
      const latestResult = await pool.query(latestQuery);

      status[ivl] = {
        viewName: config.viewName,
        description: config.description,
        bucketInterval: config.bucketInterval,
        exists: result.rows.length > 0,
        rowCount: parseInt(countResult.rows[0].count, 10),
        latestBucket: latestResult.rows[0].latest,
        info: result.rows[0] || null
      };
    } catch (err) {
      logger.error({ err, interval: ivl }, 'Failed to get aggregate status');
      status[ivl] = {
        error: err.message
      };
    }
  }

  return status;
};

/**
 * Check if market is open (PKT timezone - Pakistan Standard Time)
 * @param {Date} date - Date to check (default: now)
 * @returns {boolean} True if market is open
 */
export const isMarketOpen = (date = new Date()) => {
  // Pakistan Standard Time (UTC+5)
  const pktDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  const dayOfWeek = pktDate.getDay();
  const hours = pktDate.getHours();
  const minutes = pktDate.getMinutes();
  const minuteOfDay = hours * 60 + minutes;

  // Market is closed on weekends (Saturday = 6, Sunday = 0)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Market hours: 9:30 AM to 3:30 PM PKT (09:30 to 15:30)
  const marketOpenMinute = 9 * 60 + 30; // 9:30 AM
  const marketCloseMinute = 15 * 60 + 30; // 3:30 PM

  return minuteOfDay >= marketOpenMinute && minuteOfDay <= marketCloseMinute;
};

/**
 * Get market hours in PKT timezone
 * @returns {Object} Market hours information
 */
export const getMarketHours = () => {
  return {
    timezone: 'Asia/Karachi',
    open: '09:30',
    close: '15:30',
    openMinute: 9 * 60 + 30,
    closeMinute: 15 * 60 + 30,
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  };
};

export const closePool = () => pool.end();

export default {
  getAggregatedBars,
  getLatestBar,
  getBarsBySymbols,
  refreshAggregate,
  getAggregateStatus,
  isMarketOpen,
  getMarketHours,
  INTERVAL_CONFIGS,
  closePool
};


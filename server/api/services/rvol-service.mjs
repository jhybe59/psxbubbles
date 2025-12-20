/**
 * RVOL Service
 * Handles precision Relative Volume (RVOL) calculations using QuestDB
 */
import { queryQuestDB } from '../questdb.mjs';
import logger from '../logger.mjs';

/**
 * Map interval strings to QuestDB SAMPLE BY formats and minute durations
 */
const INTERVAL_MAP = {
  '1m': { sample: '1m', minutes: 1 },
  '5m': { sample: '5m', minutes: 5 },
  '15m': { sample: '15m', minutes: 15 },
  '1h': { sample: '1h', minutes: 60 },
  'Day': { sample: '1d', minutes: 1440 },
  '1d': { sample: '1d', minutes: 1440 }
};

/**
 * Calculate RVOL for a list of symbols
 * Formula: Current Volume / Average Volume of last N completed buckets
 * 
 * @param {string[]} symbols - List of symbols
 * @param {string} interval - '1m', '5m', '1h', 'Day'
 * @param {number} lookback - Number of historical buckets to average (default 20)
 * @returns {Promise<Map<string, number>>} - Map of symbol -> RVOL value
 */
export async function getBatchRVOL(symbols, interval = '1m', lookback = 20) {
  const cfg = INTERVAL_MAP[interval] || INTERVAL_MAP['1m'];
  const sampleBy = cfg.sample;

  // To get the "average of last N finished buckets", we need to:
  // 1. Get N + 1 buckets (including the current one)
  // 2. Exclude the current partially-filled bucket
  // 3. Average the remaining N

  const limit = lookback + 1;
  const symbolFilter = symbols && symbols.length > 0
    ? `WHERE symbol IN (${symbols.map(s => `'${s}'`).join(',')})`
    : '';

  // SQL Logic for QuestDB:
  // We use SAMPLE BY to aggregate minute_bars into the requested interval.
  // We wrap this in a subquery to calculate the average and compare with the latest.
  const sql = `
    WITH stats AS (
      SELECT 
        symbol,
        timestamp as ts,
        sum(volume) as vol
      FROM minute_bars
      ${symbolFilter}
      SAMPLE BY ${sampleBy} ALIGN TO CALENDAR TIME ZONE 'Asia/Karachi'
    ),
    with_avg AS (
      SELECT 
        symbol,
        vol,
        ts,
        avg(vol) OVER (PARTITION BY symbol ORDER BY ts ROWS BETWEEN ${lookback} PRECEDING AND 1 PRECEDING) as avg_vol,
        row_number() OVER (PARTITION BY symbol ORDER BY ts DESC) as rnk
      FROM stats
    )
    SELECT 
      symbol,
      vol as current_vol,
      avg_vol
    FROM with_avg
    WHERE rnk = 1 AND avg_vol > 0
  `;

  try {
    const result = await queryQuestDB(sql);
    if (!result || !result.dataset) return new Map();

    const rvolMap = new Map();
    const colIndex = {};
    result.columns.forEach((col, idx) => colIndex[col.name] = idx);

    for (const row of result.dataset) {
      const symbol = row[colIndex['symbol']];
      const cur = parseFloat(row[colIndex['current_vol']]);
      const avg = parseFloat(row[colIndex['avg_vol']]);

      if (avg > 0) {
        rvolMap.set(symbol, cur / avg);
      }
    }

    return rvolMap;
  } catch (err) {
    logger.error({ err, interval, lookback }, 'Failed to calculate batch RVOL');
    return new Map();
  }
}

/**
 * Calculate RVOL for tick-based intervals
 * Logic: Compare volume of last N trades vs average volume of previous blocks of N trades
 * 
 * @param {string[]} symbols - List of symbols
 * @param {number} tickCount - Number of ticks in a block (10, 100, 500, 1000)
 * @param {number} lookback - Number of historical blocks to average (default 20)
 */
export async function getBatchTickRVOL(symbols, tickCount = 100, lookback = 20) {
  const symbolFilter = symbols && symbols.length > 0
    ? `WHERE symbol IN (${symbols.map(s => `'${s}'`).join(',')})`
    : '';

  // We use a window function to sum volume in chunks of tickCount
  // Then we average those chunk sums
  const sql = `
    WITH raw_data AS (
      SELECT 
        symbol,
        volume,
        timestamp,
        row_number() OVER (PARTITION BY symbol ORDER BY timestamp DESC) as trade_rn
      FROM trades
      ${symbolFilter}
    ),
    blocks AS (
      SELECT 
        symbol,
        (trade_rn - 1) / ${tickCount} as block_id,
        sum(volume) as block_vol
      FROM raw_data
      WHERE trade_rn <= ${tickCount * (lookback + 1)}
      GROUP BY symbol, (trade_rn - 1) / ${tickCount}
    ),
    with_avg AS (
      SELECT 
        symbol,
        block_id,
        block_vol,
        avg(block_vol) OVER (PARTITION BY symbol ORDER BY block_id DESC ROWS BETWEEN ${lookback} PRECEDING AND 1 PRECEDING) as avg_block_vol
      FROM blocks
    )
    SELECT 
      symbol,
      block_vol as current_vol,
      avg_block_vol as avg_vol
    FROM with_avg
    WHERE block_id = 0 AND avg_block_vol > 0
  `;

  try {
    const result = await queryQuestDB(sql);
    if (!result || !result.dataset) return new Map();

    const rvolMap = new Map();
    const colIndex = {};
    result.columns.forEach((col, idx) => colIndex[col.name] = idx);

    for (const row of result.dataset) {
      const symbol = row[colIndex['symbol']];
      const cur = parseFloat(row[colIndex['current_vol']]);
      const avg = parseFloat(row[colIndex['avg_vol']]);

      if (avg > 0) {
        rvolMap.set(symbol, cur / avg);
      }
    }

    return rvolMap;
  } catch (err) {
    logger.error({ err, tickCount, lookback }, 'Failed to calculate batch tick RVOL');
    return new Map();
  }
}

export default {
  getBatchRVOL,
  getBatchTickRVOL
};

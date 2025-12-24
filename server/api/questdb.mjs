/**
 * QuestDB HTTP Client for querying time-series data
 */
import { config } from './config.mjs';
import logger from './logger.mjs';

const QUESTDB_BASE_URL = `http://${config.questdb?.host || 'localhost'}:${config.questdb?.httpPort || 9000}`;

/**
 * Execute a SQL query against QuestDB
 * @param {string} sql - SQL query to execute
 * @returns {Promise<{columns: Array, dataset: Array}>}
 */
export async function queryQuestDB(sql) {
    const url = `${QUESTDB_BASE_URL}/exec?query=${encodeURIComponent(sql)}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        const result = await response.json();

        // Handle table not exists error gracefully (returns empty data)
        if (result.error && result.error.includes('table does not exist')) {
            logger.warn({ table: 'trades' }, 'QuestDB table not exists yet - returning empty result');
            return { columns: [], dataset: [] };
        }

        if (result.error) {
            throw new Error(`QuestDB query failed: ${result.error}`);
        }

        return result;
    } catch (err) {
        logger.error({ err, sql: sql.substring(0, 100) }, 'QuestDB query error');
        throw err;
    }
}

/**
 * Get latest bars for all symbols using LATEST ON
 * This is QuestDB's killer feature - instant results!
 */
export async function getLatestBars(symbols = null) {
    // trades table has: symbol, timestamp, price, volume, value
    // We need to aggregate to get OHLC
    let sql = `
    SELECT symbol, timestamp as ts, 
           price as open, price as high, price as low, price as close, 
           volume, value, 0 as daily_pct
    FROM trades
    LATEST ON timestamp PARTITION BY symbol
  `;

    if (symbols && symbols.length > 0) {
        const symbolList = symbols.map(s => `'${s}'`).join(',');
        sql += ` WHERE symbol IN (${symbolList})`;
    }

    return queryQuestDB(sql);
}

/**
 * Get aggregated bars using SAMPLE BY
 * @param {string} interval - e.g., '5m', '15m', '1h', '1d'
 */
export async function getAggregatedBars(interval, symbols = null, limit = 100) {
    // Map interval to QuestDB SAMPLE BY format
    const intervalMap = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '1h': '1h',
        'Day': '1d',
        '1d': '1d'
    };

    const sampleBy = intervalMap[interval] || '1m';

    // trades table has price column - aggregate it for OHLC
    let sql = `
    SELECT 
      symbol,
      timestamp as ts,
      first(price) as open,
      max(price) as high,
      min(price) as low,
      last(price) as close,
      sum(volume) as volume,
      sum(value) as value,
      0 as daily_pct
    FROM trades
  `;

    if (symbols && symbols.length > 0) {
        const symbolList = symbols.map(s => `'${s}'`).join(',');
        sql += ` WHERE symbol IN (${symbolList})`;
    }

    sql += ` SAMPLE BY ${sampleBy} ALIGN TO CALENDAR`;
    sql += ` ORDER BY timestamp DESC`;
    sql += ` LIMIT ${limit}`;

    return queryQuestDB(sql);
}

export default {
    queryQuestDB,
    getLatestBars,
    getAggregatedBars
};

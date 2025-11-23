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

export const insertMinuteBars = async (rows) => {
  if (!rows || rows.length === 0) return 0;
  
  // Deduplicate rows within the batch (keep last occurrence of same symbol+ts)
  const uniqueRows = new Map();
  rows.forEach((row) => {
    const key = `${row.symbol}|${row.ts}`;
    uniqueRows.set(key, row);
  });
  const deduplicatedRows = Array.from(uniqueRows.values());
  
  if (deduplicatedRows.length === 0) return 0;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const text = `
      INSERT INTO minute_bars
        (symbol, ts, open, high, low, close, volume, value, daily_pct, raw)
      VALUES
        ${deduplicatedRows.map((_, idx) => `($${idx * 10 + 1}, $${idx * 10 + 2}, $${idx * 10 + 3}, $${idx * 10 + 4}, $${idx * 10 + 5}, $${idx * 10 + 6}, $${idx * 10 + 7}, $${idx * 10 + 8}, $${idx * 10 + 9}, $${idx * 10 + 10})`).join(', ')}
      ON CONFLICT (symbol, ts)
      DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume = EXCLUDED.volume,
        value = EXCLUDED.value,
        daily_pct = EXCLUDED.daily_pct,
        raw = EXCLUDED.raw
      RETURNING ts;
    `;
    const values = deduplicatedRows.flatMap((row) => [
      row.symbol,
      new Date(row.ts),
      row.open,
      row.high,
      row.low,
      row.close,
      row.volume,
      row.value,
      row.daily_pct,
      row.raw ? JSON.stringify(row.raw) : null
    ]);
    const result = await client.query(text, values);
    await client.query('COMMIT');
    return result.rowCount;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'Failed to upsert minute bars');
    throw err;
  } finally {
    client.release();
  }
};

export const withClient = async (fn) => {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
};

export const closePool = () => pool.end();

export { pool };

export default {
  insertMinuteBars,
  withClient,
  closePool,
  pool
};


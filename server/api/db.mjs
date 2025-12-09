import pg from 'pg';
import { config } from './config.mjs';
import logger from './logger.mjs';

const { Pool } = pg;

// Helper to check if Postgres config exists meaningfully
const hasPostgresConfig = () => {
  return config.timescale && config.timescale.host && config.timescale.host !== 'postgres';
}

let pool = null;

try {
  // Only attempt connection if we likely have a real DB (not just 'postgres' host from docker default if it's gone)
  // For now, we wrap in try-catch to prevent startup crash if params are bad
  pool = new Pool({
    host: config.timescale.host,
    port: config.timescale.port,
    database: config.timescale.database,
    user: config.timescale.user,
    password: config.timescale.password,
    ssl: config.timescale.ssl ? { rejectUnauthorized: false } : undefined,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000 // fast fail
  });

  // Suppress unhandled error on idle clients
  pool.on('error', (err) => {
    logger.warn({ err }, 'Unexpected error on idle PostgreSQL client');
  });
} catch (err) {
  logger.warn('Failed to initialize PostgreSQL pool (static data will be unavailable)');
}

export const query = (text, params) => {
  if (!pool) return Promise.reject(new Error('PostgreSQL not configured'));
  return pool.query(text, params);
};

export const withClient = async (fn) => {
  if (!pool) return null; // Graceful fallback for static data
  let client;
  try {
    client = await pool.connect();
    return await fn(client);
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to connect to PostgreSQL');
    return null; // Return null so callers like getIndexSymbols just return nothing instead of crashing
  } finally {
    if (client) client.release();
  }
};

export const closePool = () => pool ? pool.end() : Promise.resolve();

export default {
  pool,
  query,
  withClient,
  closePool
};


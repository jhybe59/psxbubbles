import pg from 'pg';
import { config } from './config.mjs';

const { Pool } = pg;

export const pool = new Pool({
  host: config.timescale.host,
  port: config.timescale.port,
  database: config.timescale.database,
  user: config.timescale.user,
  password: config.timescale.password,
  ssl: config.timescale.ssl ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000
});

export const query = (text, params) => pool.query(text, params);

export const withClient = async (fn) => {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
};

export const closePool = () => pool.end();

export default {
  pool,
  query,
  withClient,
  closePool
};


import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenvSafe from 'dotenv-safe';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const envPath = path.join(projectRoot, '.env');
const examplePath = path.join(projectRoot, 'config', 'env.example');

try {
  dotenvSafe.config({
    allowEmptyValues: true,
    example: examplePath,
    path: fs.existsSync(envPath) ? envPath : undefined,
    silent: true
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn('[api/config] dotenv-safe warning:', err.message);
}

const numberOr = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const boolOr = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: numberOr(process.env.API_PORT, 8080),
  logLevel: process.env.LOG_LEVEL || 'info',
  apiKeys: {
    primary: process.env.API_KEY_PRIMARY,
    secondary: process.env.API_KEY_SECONDARY
  },
  rateLimit: {
    points: numberOr(process.env.API_RATE_LIMIT_POINTS, 100),
    duration: numberOr(process.env.API_RATE_LIMIT_DURATION, 60)
  },
  timescale: {
    host: process.env.TIMESCALE_HOST || 'localhost',
    port: numberOr(process.env.TIMESCALE_PORT, 5432),
    database: process.env.TIMESCALE_DB || 'cryptobubbles',
    user: process.env.TIMESCALE_USER || 'postgres',
    password: process.env.TIMESCALE_PASSWORD || 'postgres',
    ssl: boolOr(process.env.TIMESCALE_SSL, false)
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  }
};

export default config;


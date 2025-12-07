import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenvSafe from 'dotenv-safe';
import { buildTimescaleConfigFromEnv } from '../shared/db-config.mjs';

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
  // Honour Railway/Heroku style PORT, fallback to API_PORT, then 8080
  port: numberOr(process.env.PORT ?? process.env.API_PORT, 8080),
  logLevel: process.env.LOG_LEVEL || 'info',
  apiKeys: {
    primary: process.env.API_KEY_PRIMARY,
    secondary: process.env.API_KEY_SECONDARY
  },
  rateLimit: {
    points: numberOr(process.env.API_RATE_LIMIT_POINTS, 100),
    duration: numberOr(process.env.API_RATE_LIMIT_DURATION, 60)
  },
  timescale: buildTimescaleConfigFromEnv(process.env),
  redis: {
    // Make Redis optional by default in hosted envs
    url: process.env.REDIS_URL || ''
  },
  questdb: {
    host: process.env.QUESTDB_HOST || 'localhost',
    httpPort: numberOr(process.env.QUESTDB_HTTP_PORT, 9000),
    ilpPort: numberOr(process.env.QUESTDB_ILP_PORT, 9009)
  }
};

export default config;


import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenvSafe from 'dotenv-safe';
import { buildTimescaleConfigFromEnv } from '../../server/shared/db-config.mjs';

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
  console.warn('[ingestion/config] dotenv-safe unable to load .env file:', err.message);
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

const timeToMinutes = (value, fallback) => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const stringValue = String(value).trim();
  if (!stringValue) return fallback;

  const match = stringValue.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (Number.isFinite(hours) && Number.isFinite(minutes) && minutes >= 0 && minutes < 60) {
      return hours * 60 + minutes;
    }
  }

  const numeric = Number(stringValue);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  timescale: buildTimescaleConfigFromEnv(process.env),
  redis: {
    url: process.env.REDIS_URL || ''
  },
  questdb: {
    host: process.env.QUESTDB_HOST || 'localhost',
    httpPort: numberOr(process.env.QUESTDB_HTTP_PORT, 9000),
    ilpPort: numberOr(process.env.QUESTDB_ILP_PORT, 9009)
  },
  psxApi: {
    // baseUrl: process.env.PSX_API_BASE_URL, // Removed REST URL
    // token: process.env.PSX_API_TOKEN,
    // timeoutMs: numberOr(process.env.PSX_API_TIMEOUT_MS, 10000),
    // batchSize: numberOr(process.env.PSX_API_BATCH_SIZE, 50),
    // strategy: process.env.PSX_API_STRATEGY || 'klines',
    // interval: process.env.PSX_API_INTERVAL || '1m',
    // limit: numberOr(process.env.PSX_API_LIMIT, 1),
    // market: process.env.PSX_API_MARKET || 'REG',
    // maxRequestsPerMinute: numberOr(process.env.PSX_API_MAX_REQUESTS_PER_MINUTE, 100),

    // WebSocket URL
    wsUrl: process.env.PSX_WS_URL || 'wss://psxterminal.com/',

    // Support for specific symbols list (comma-separated)
    // If not provided via env, use the default 75 symbols list
    symbolsList: process.env.PSX_API_SYMBOLS_LIST
      ? process.env.PSX_API_SYMBOLS_LIST.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : [
        // Original 76 symbols
        'PIBTL', 'BECO', 'MLCF', 'LOTCHEM', 'KEL', 'TELE', 'PRL', 'CNERGY', 'GCIL', 'PAEL',
        'BNL', 'TREET', 'PIOC', 'TPLP', 'BFAGRO', 'TOMCL', 'FCCL', 'OBOY', 'WASL', 'EPCL',
        'GATM', 'QUICE', 'SSGC', 'DGKC', 'FFC', 'PPL', 'POWER', 'SEARL', 'ATRL', 'FFL',
        'SLGL', 'CEPB', 'SNGP', 'DCL', 'UNITY', 'ASL', 'MUGHAL', 'FCL', 'TGL', 'MACFL',
        'CRTM', 'GWLC', 'HUBC', 'MEBL', 'OGDC', 'EMCO', 'FATIMA', 'IMAGE', 'SYS', 'CPHL',
        'BGL', 'CTM', 'BIPL', 'AVN', 'JVDC', 'TRSM', 'MARI', 'NETSOL', 'YOUW', 'SYM',
        'BFMOD', 'GHGL', 'OCTOPUS', 'BBFL', 'GAL', 'BIFO', 'GHNI', 'SAZEW', 'FLYNG', 'ISL',
        'GGL', 'GGGL', 'PSO', 'GCWL', 'IBLHL', 'LUCK',
        // New 21 symbols (CNERGY, PRL, FFC already existed above)
        'NRL', 'SGPL', 'FABL', 'ENGROH', 'ZAL', 'WAVES', 'AIRLINK', 'SEL', 'LOADS', 'NML',
        'CHCC', 'LIVEN', 'KOHC', 'UCAPM', 'KSBP', 'FECTC', 'ITTEFAQ', 'ANL', 'DOL', 'FECPL',
        'NATF'
      ]
  },
  worker: {
    cron: process.env.WORKER_POLL_CRON || '* * * * *',
    maxRetries: numberOr(process.env.WORKER_MAX_RETRIES, 3),
    retryBackoffSeconds: numberOr(process.env.WORKER_RETRY_BACKOFF_SECONDS, 30),
    symbolsPerMinute: numberOr(process.env.WORKER_SYMBOLS_PER_MINUTE, 100),
    marketOpenMinute: timeToMinutes(
      process.env.WORKER_MARKET_OPEN_TIME ?? process.env.WORKER_MARKET_OPEN_MINUTE,
      8 * 60 + 0 // 08:00 AM
    ),
    marketCloseMinute: timeToMinutes(
      process.env.WORKER_MARKET_CLOSE_TIME ?? process.env.WORKER_MARKET_CLOSE_MINUTE,
      17 * 60 + 0 // 05:00 PM
    ),
    symbolFetchDelayMinutes: numberOr(process.env.WORKER_SYMBOL_FETCH_DELAY_MINUTES, 2)
  },
  metrics: {
    port: numberOr(process.env.METRICS_PORT, 9100)
  }
};

export default config;


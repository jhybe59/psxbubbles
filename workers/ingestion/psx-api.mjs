import axios from 'axios';
import { Counter, register } from 'prom-client';
import { config } from './config.mjs';
import logger from './logger.mjs';

const getOrCreateCounter = (name, help, labelNames) => {
  const existing = register.getSingleMetric(name);
  if (existing) return existing;
  return new Counter({ name, help, labelNames });
};

const apiRequestCounter = getOrCreateCounter(
  'ingestion_psx_requests_total',
  'Total PSX API requests grouped by operation and status',
  ['operation', 'status']
);

const apiRetryCounter = getOrCreateCounter(
  'ingestion_psx_retries_total',
  'Retry attempts against the PSX API grouped by operation and reason',
  ['operation', 'reason']
);

const apiFailureCounter = getOrCreateCounter(
  'ingestion_psx_failures_total',
  'Irrecoverable PSX API failures grouped by operation',
  ['operation']
);

const client = axios.create({
  baseURL: config.psxApi.baseUrl,
  timeout: config.psxApi.timeoutMs,
  headers: {
    'Content-Type': 'application/json'
  }
});

client.interceptors.request.use((request) => {
  if (config.psxApi.token) {
    request.headers.Authorization = `Bearer ${config.psxApi.token}`;
  }
  return request;
});

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const computeBackoffMs = (attempt) => {
  const base = Math.max(1, config.worker.retryBackoffSeconds || 30) * 1000;
  const exponential = base * 2 ** (attempt - 1);
  const jitter = Math.random() * 0.3 * exponential;
  return Math.min(exponential + jitter, 5 * 60 * 1000);
};

const classifyError = (err) => {
  const status = err?.response?.status;
  if (status === 429) return { retry: true, reason: 'rate_limit' };
  if (status >= 500 && status < 600) return { retry: true, reason: `http_${status}` };
  if (err?.code && ['ECONNABORTED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'].includes(err.code)) {
    return { retry: true, reason: err.code.toLowerCase() };
  }
  return { retry: false, reason: status ? `http_${status}` : err?.code || 'unknown' };
};

const createRateLimiter = (requestsPerMinute = 0) => {
  if (!requestsPerMinute || requestsPerMinute <= 0) {
    return { acquire: async () => {} };
  }

  let tokens = requestsPerMinute;
  let lastRefill = Date.now();

  const refill = () => {
    const now = Date.now();
    if (now <= lastRefill) return;
    const elapsed = now - lastRefill;
    const increment = (elapsed / 60000) * requestsPerMinute;
    tokens = Math.min(requestsPerMinute, tokens + increment);
    lastRefill = now;
  };

  const acquire = async () => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      refill();
      if (tokens >= 1) {
        tokens -= 1;
        return;
      }
      await sleep(200);
    }
  };

  return { acquire };
};

const rateLimiter = createRateLimiter(config.psxApi.maxRequestsPerMinute);

const executeRequest = async (operation, fn) => {
  const maxAttempts = Math.max(1, config.worker.maxRetries || 3);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await rateLimiter.acquire();
      const response = await fn();
      const status = response?.status ?? 200;
      apiRequestCounter.inc({ operation, status: String(status) });
      return response;
    } catch (err) {
      const decision = classifyError(err);
      const status = err?.response?.status ? String(err.response.status) : decision.reason || 'error';
      apiRequestCounter.inc({ operation, status });

      if (!decision.retry || attempt === maxAttempts) {
        apiFailureCounter.inc({ operation });
        throw err;
      }

      const delay = computeBackoffMs(attempt);
      apiRetryCounter.inc({ operation, reason: decision.reason });
      logger.warn({ operation, attempt, delay, reason: decision.reason, err: err.message }, 'Retrying PSX API request');
      await sleep(delay);
    }
  }

  throw new Error(`Failed to execute PSX API request for ${operation}`);
};

const arrayRowToObject = (row = [], symbol) => {
  const [
    ts,
    open,
    high,
    low,
    close,
    volume,
    turnover,
    intervalPct,
    dailyPct
  ] = row;

  return {
    symbol,
    ts,
    open,
    high,
    low,
    close,
    volume,
    turnover,
    intervalPct,
    dailyPct,
    raw: row
  };
};

const unwrapPayload = (response) => {
  if (!response) return [];
  const { data } = response;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.symbols)) return data.symbols;
  return [];
};

const normaliseEntry = (entry, fallbackSymbol) => {
  if (!entry) return [];

  const coerceRow = (row, symbol) => {
    if (!row) return null;
    if (Array.isArray(row)) {
      return arrayRowToObject(row, symbol);
    }
    return {
      symbol: row.symbol ?? symbol ?? fallbackSymbol,
      ts: row.ts ?? row.timestamp ?? row.time ?? row[0],
      open: row.open ?? row.o,
      high: row.high ?? row.h,
      low: row.low ?? row.l,
      close: row.close ?? row.c,
      volume: row.volume ?? row.v,
      turnover: row.turnover ?? row.value ?? row.amount,
      intervalPct: row.intervalPct ?? row.pct_change ?? row.changePct ?? row.change_pct,
      dailyPct: row.dailyPct ?? row.daily_change_pct ?? row.dailyChangePct,
      raw: row
    };
  };

  if (Array.isArray(entry)) {
    const row = coerceRow(entry, fallbackSymbol);
    return row ? [row] : [];
  }

  if (Array.isArray(entry?.bars)) {
    const symbol = entry.symbol ?? fallbackSymbol;
    return entry.bars
      .map((bar) => coerceRow(bar, symbol))
      .filter(Boolean);
  }

  if (Array.isArray(entry?.data)) {
    const symbol = entry.symbol ?? fallbackSymbol;
    return entry.data
      .map((bar) => coerceRow(bar, symbol))
      .filter(Boolean);
  }

  const row = coerceRow(entry, fallbackSymbol);
  return row ? [row] : [];
};

const chunk = (arr, size) => {
  if (size <= 0) return [arr];
  const batches = [];
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size));
  }
  return batches.length ? batches : [[]];
};

const fetchViaMinuteBars = async (symbols = []) => {
  const batchSize = Math.max(1, config.psxApi.batchSize || 80);
  const interval = config.psxApi.interval || '1m';
  const limit = Math.max(1, config.psxApi.limit || 120);
  const market = config.psxApi.market;

  const batches = chunk(symbols, batchSize);
  const allRows = [];

  for (const batch of batches) {
    try {
      const params = {
        symbols: batch.join(',') || undefined,
        interval,
        limit
      };
      if (market) params.market = market;
      const response = await executeRequest('minute_bars', () => client.get('/minute-bars', {
        params
      }));
      const payload = unwrapPayload(response);
      if (!payload.length && batch.length === 1) {
        // Some providers nest by symbol: { symbol: 'OGDC', bars: [...] }
        if (response?.data && typeof response.data === 'object') {
          const nested = Object.values(response.data)
            .flatMap((value) => normaliseEntry(value, batch[0]));
          allRows.push(...nested);
          continue;
        }
      }

      const rows = payload.flatMap((entry) => normaliseEntry(entry, batch.length === 1 ? batch[0] : entry?.symbol));
      allRows.push(...rows);
    } catch (err) {
      logger.error({ err, batch }, 'Failed to fetch minute bars');
      throw err;
    }
  }

  return allRows;
};

const fetchViaKlines = async (symbols = []) => {
  const interval = config.psxApi.interval || '1m';
  const limit = Math.max(1, config.psxApi.limit || 1);
  const allRows = [];
  const targets = symbols.length ? symbols : [];

  for (const symbol of targets) {
    try {
      const response = await executeRequest('klines', () => client.get(`/klines/${symbol}/${interval}`, {
        params: { limit }
      }));
      const payload = unwrapPayload(response);
      const rows = payload
        .map((row) => {
          if (Array.isArray(row)) {
            return arrayRowToObject(row, symbol);
          }
          if (row && typeof row === 'object') {
            return {
              symbol: row.symbol ?? symbol,
              ...row
            };
          }
          return null;
        })
        .filter(Boolean);
      allRows.push(...rows);
    } catch (err) {
      logger.error({ err, symbol, interval }, 'Failed to fetch klines');
      throw err;
    }
  }

  return allRows;
};

const fetchViaTicks = async () => {
  const market = config.psxApi.market || 'REG';
  try {
    const response = await executeRequest('ticks', () => client.get(`/ticks/${market}`));
    const payload = unwrapPayload(response);
    return payload.map((row) => ({
      symbol: row.symbol ?? row.ticker,
      ...row
    }));
  } catch (err) {
    logger.error({ err, market }, 'Failed to fetch ticks snapshot');
    throw err;
  }
};

export const fetchMinuteBars = async (symbols = []) => {
  if (!config.psxApi.baseUrl) {
    throw new Error('PSX_API_BASE_URL environment variable is required');
  }

  const strategy = (config.psxApi.strategy || 'klines').toLowerCase();

  if (strategy === 'minute-bars' || strategy === 'bars') {
    return fetchViaMinuteBars(symbols);
  }

  if (strategy === 'ticks') {
    return fetchViaTicks();
  }

  return fetchViaKlines(symbols);
};

export default {
  fetchMinuteBars
};

export const fetchSymbols = async () => {
  if (!config.psxApi.baseUrl) {
    throw new Error('PSX_API_BASE_URL environment variable is required');
  }

  const response = await executeRequest('symbols', () => client.get('symbols'));
  const payload = unwrapPayload(response);
  if (!Array.isArray(payload)) return [];
  return payload
    .map((symbol) => (typeof symbol === 'string' ? symbol.trim().toUpperCase() : null))
    .filter(Boolean);
};



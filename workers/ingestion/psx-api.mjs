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

const fetchViaKlines = async (symbols = [], timestamp = null) => {
  const interval = config.psxApi.interval || '1m';
  const allRows = [];
  const targets = symbols.length ? symbols : [];

  for (const symbol of targets) {
    try {
      // Use /api/klines/{symbol}/{timeframe}/{timestamp} endpoint
      // Base URL already includes /api, so we use /klines directly
      let url = `/klines/${symbol}/${interval}`;
      
      // If timestamp provided, append it to URL
      if (timestamp != null) {
        // Ensure timestamp is in milliseconds (13 digits)
        const timestampMs = typeof timestamp === 'number' 
          ? (timestamp < 10 ** 12 ? timestamp * 1000 : timestamp)
          : new Date(timestamp).getTime();
        url = `${url}/${timestampMs}`;
      }
      
      const response = await executeRequest('klines', () => client.get(url));
      
      // Handle response structure: { success: true, data: {...}, timestamp: ... }
      const responseData = response?.data;
      
      if (!responseData) {
        logger.warn({ symbol, interval, timestamp }, 'Empty klines response');
        continue;
      }
      
      // Check if response has nested data structure
      let candleData = null;
      if (responseData.success && responseData.data) {
        // New format: { success: true, data: { symbol, timeframe, timestamp, open, high, low, close, volume } }
        candleData = responseData.data;
      } else if (responseData.symbol || responseData.open) {
        // Direct object format
        candleData = responseData;
      } else if (Array.isArray(responseData)) {
        // Array format - take first element
        candleData = responseData[0];
      } else if (Array.isArray(responseData.data)) {
        // Array in data field
        candleData = responseData.data[0];
      }
      
      if (!candleData) {
        logger.warn({ symbol, interval, timestamp, responseData }, 'Invalid klines response structure');
        continue;
      }
      
      // Normalize to our format
      const row = {
        symbol: candleData.symbol ?? symbol,
        ts: candleData.timestamp ?? timestamp ?? Date.now(),
        open: Number(candleData.open ?? 0),
        high: Number(candleData.high ?? 0),
        low: Number(candleData.low ?? 0),
        close: Number(candleData.close ?? 0),
        volume: Number(candleData.volume ?? 0),
        turnover: candleData.turnover != null ? Number(candleData.turnover) : null,
        intervalPct: candleData.intervalPct != null ? Number(candleData.intervalPct) : null,
        dailyPct: candleData.dailyPct != null ? Number(candleData.dailyPct) : null,
        raw: responseData
      };
      
      // Calculate intervalPct if not provided
      if (row.intervalPct == null && row.open && row.close && row.open !== 0) {
        row.intervalPct = ((row.close - row.open) / row.open) * 100;
      }
      
      allRows.push(row);
    } catch (err) {
      // Don't throw for individual symbol failures - log and continue
      if (err?.response?.status === 404) {
        logger.warn({ symbol, interval, timestamp }, 'Kline not found (404), skipping symbol');
        continue;
      }
      logger.error({ err, symbol, interval, timestamp }, 'Failed to fetch klines');
      // Continue with other symbols instead of throwing
      continue;
    }
  }

  return allRows;
};

const fetchViaExactTimestampKlines = async (symbols = [], timestamp) => {
  const interval = config.psxApi.interval || '1m';
  const allRows = [];
  const targets = symbols.length ? symbols : [];

  if (!targets.length) return [];

  // Ensure timestamp is 13-digit milliseconds
  const exactTimestamp = timestamp || Date.now();
  const timestampMs = exactTimestamp < 10 ** 12 ? exactTimestamp * 1000 : exactTimestamp;

  for (const symbol of targets) {
    try {
      const response = await executeRequest('klines_exact', () =>
        client.get(`/klines/${symbol}/${interval}/${timestampMs}`)
      );

      const payload = response?.data?.data ?? response?.data;
      if (!payload) {
        logger.warn({ symbol, timestamp: timestampMs }, 'No kline data returned for exact timestamp');
        continue;
      }

      // Normalize the response to match our expected format
      const row = {
        symbol: (payload.symbol ?? symbol ?? '').toString().trim().toUpperCase(),
        ts: payload.timestamp ?? timestampMs,
        open: Number(payload.open ?? 0),
        high: Number(payload.high ?? 0),
        low: Number(payload.low ?? 0),
        close: Number(payload.close ?? 0),
        volume: Number(payload.volume ?? 0),
        turnover: null, // API doesn't provide turnover in kline response
        intervalPct: null,
        dailyPct: null,
        raw: payload
      };

      // Calculate percentage change if we have open and close
      if (row.open && row.close && row.open !== 0) {
        row.intervalPct = ((row.close - row.open) / row.open) * 100;
      }

      allRows.push(row);
    } catch (err) {
      if (err?.response?.status === 404) {
        logger.warn({ symbol, timestamp: timestampMs }, 'Kline not found for exact timestamp (404), skipping');
        continue;
      }
      logger.error({ err, symbol, timestamp: timestampMs }, 'Failed to fetch exact timestamp kline');
      // Don't throw - continue with other symbols
    }
  }

  return allRows;
};

const coerceTickTimestamp = (value) => {
  if (value == null) return Date.now();
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Date.now();
  return numeric < 10 ** 12 ? numeric * 1000 : numeric;
};

const fetchViaTicks = async (symbols = []) => {
  const market = config.psxApi.market || 'REG';
  const targets = symbols.length ? symbols : [];
  if (!targets.length) return [];

  const rows = [];

  for (const symbol of targets) {
    try {
      const response = await executeRequest('ticks', () => client.get(`/ticks/${market}/${symbol}`));
      const payload = response?.data?.data ?? response?.data;
      if (!payload) continue;

      const price = Number(payload.price ?? payload.last ?? payload.close);
      if (!Number.isFinite(price)) {
        logger.warn({ symbol, market, payload }, 'Tick payload missing price');
        continue;
      }

      const changePercent = payload.changePercent != null ? Number(payload.changePercent) : null;
      const pctScaled = Number.isFinite(changePercent) ? changePercent * 100 : null;

      rows.push({
        symbol: (payload.symbol ?? symbol ?? '').toString().trim().toUpperCase(),
        ts: coerceTickTimestamp(payload.timestamp ?? payload.ts ?? payload.time),
        price,
        open: payload.open ?? price,
        high: payload.high ?? price,
        low: payload.low ?? price,
        close: payload.close ?? price,
        volume: payload.volume ?? payload.tradesVolume ?? 0,
        turnover: payload.value ?? payload.turnover ?? null,
        intervalPct: pctScaled,
        dailyPct: pctScaled,
        raw: payload
      });
    } catch (err) {
      if (err?.response?.status === 404) {
        logger.warn({ symbol, market }, 'Tick snapshot not found (404), skipping symbol');
        continue;
      }
      logger.error({ err, symbol, market }, 'Failed to fetch tick snapshot');
      throw err;
    }
  }

  return rows;
};

export const fetchMinuteBars = async (symbols = [], timestamp = null) => {
  if (!config.psxApi.baseUrl) {
    throw new Error('PSX_API_BASE_URL environment variable is required');
  }

  const strategy = (config.psxApi.strategy || 'klines').toLowerCase();

  // Use klines endpoint for 1-minute candle ingestion
  if (strategy === 'klines') {
    return fetchViaKlines(symbols, timestamp);
  }

  // Fallback to ticks if explicitly requested
  if (strategy === 'ticks') {
    return fetchViaTicks(symbols);
  }

  if (strategy === 'minute-bars' || strategy === 'bars') {
    return fetchViaMinuteBars(symbols);
  }

  // Default to klines for 1-minute candles
  return fetchViaKlines(symbols, timestamp);
};

export { fetchViaKlines, fetchViaTicks, fetchViaMinuteBars };

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



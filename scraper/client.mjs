import WebSocket from 'ws';
import { decode } from 'msgpackr';
import { normalizeQuoteFrame, QuoteOrderGuard, sourceLagMs } from './quote.mjs';

const DEFAULT_BASE_URL = 'https://psxterminal.com';
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;
const STALE_AFTER_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 75_000;

function writeDiagnostic(level, event, details = {}) {
  process.stderr.write(`${JSON.stringify({ level, event, ...details })}\n`);
}

function validMarket(value) {
  return ['REG', 'FUT', 'IDX', 'ODL', 'BNB'].includes(value);
}

export function createQuoteScraper({
  symbol = process.env.PSXT_SYMBOL || 'OGDC',
  symbols = process.env.PSXT_SYMBOLS,
  market = process.env.PSXT_MARKET || 'REG',
  baseUrl = process.env.PSXT_BASE_URL || DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  WebSocketImpl = WebSocket,
  decodeFrame = decode,
  writeLine = (line) => process.stdout.write(`${line}\n`),
  onQuote = () => {},
  log = writeDiagnostic,
  now = () => Date.now(),
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  retryBaseMs = RETRY_BASE_MS,
  retryMaxMs = RETRY_MAX_MS,
  staleAfterMs = STALE_AFTER_MS,
  heartbeatTimeoutMs = HEARTBEAT_TIMEOUT_MS,
  random = Math.random
} = {}) {
  const normalizedSymbols = [...new Set((symbols == null ? [symbol] : String(symbols).split(','))
    .map((value) => String(value).trim().toUpperCase())
    .filter(Boolean))];
  const normalizedMarket = String(market).trim().toUpperCase();
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol)) {
    throw new Error('PSXT_BASE_URL must use http or https');
  }
  if (normalizedSymbols.length === 0 || normalizedSymbols.some((value) => !/^[A-Z0-9._-]{1,24}$/.test(value))) {
    throw new Error('PSXT_SYMBOL or PSXT_SYMBOLS must contain valid symbols');
  }
  if (!validMarket(normalizedMarket)) {
    throw new Error('PSXT_MARKET must be REG, FUT, IDX, ODL or BNB');
  }
  if (typeof fetchImpl !== 'function') throw new Error('Fetch API is unavailable');

  const origin = base.origin;
  const topics = normalizedSymbols.map((value) => `quote:${normalizedMarket}:${value}`);
  const topicSymbols = new Map(topics.map((value, index) => [value, normalizedSymbols[index]]));
  const orderGuard = new QuoteOrderGuard();
  let stopped = false;
  let socket = null;
  let retryTimer = null;
  let staleTimer = null;
  let heartbeatTimer = null;
  let retries = 0;
  let lastFrameAt = null;
  let lastQuoteAt = null;
  let staleWarned = false;
  let lastMarketStatus = null;

  const safeLog = (level, event, details = {}) => {
    try {
      log(level, event, details);
    } catch {
      // Diagnostics must not interrupt market data handling.
    }
  };

  const socketUrlFor = (token) => {
    const socketUrl = new URL('/rt', origin);
    socketUrl.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    socketUrl.searchParams.set('t', token);
    return socketUrl.toString();
  };

  const scheduleReconnect = (reason) => {
    if (stopped || retryTimer) return;
    const uncappedDelay = retryBaseMs * (2 ** Math.min(retries, 20));
    const jitteredDelay = Math.round(Math.min(retryMaxMs, uncappedDelay) * (0.8 + random() * 0.4));
    const delayMs = Math.min(retryMaxMs, jitteredDelay);
    retries += 1;
    safeLog('warn', 'reconnecting', { reason, retryMs: delayMs, attempt: retries });
    retryTimer = setTimeoutImpl(() => {
      retryTimer = null;
      void connect();
    }, delayMs);
  };

  const clearSocketTimers = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  const handleFrame = (ws, raw) => {
    let frame;
    try {
      frame = decodeFrame(raw);
    } catch (error) {
      safeLog('warn', 'malformed_message', { reason: error.message });
      return;
    }

    if (!frame || typeof frame !== 'object') {
      safeLog('warn', 'malformed_message', { reason: 'decoded frame is not an object' });
      return;
    }

    lastFrameAt = now();

    if (frame.type === 'hello') {
      safeLog('info', 'hello_received', { topics });
      if (ws.readyState === WebSocketImpl.OPEN || ws.readyState === 1) {
        ws.send(JSON.stringify({ op: 'subscribe', topics }));
      }
      return;
    }

    if (frame.type === 'ping') {
      if (ws.readyState === WebSocketImpl.OPEN || ws.readyState === 1) {
        ws.send(JSON.stringify({ op: 'pong' }));
      }
      return;
    }

    if (frame.type === 'subscribed') {
      if (Array.isArray(frame.topics) && topics.every((value) => frame.topics.includes(value))) {
        retries = 0;
        lastQuoteAt ??= now();
        safeLog('info', 'subscribed', { symbols: normalizedSymbols, market: normalizedMarket });
      }
      return;
    }

    if (frame.type === 'error') {
      safeLog('error', 'feed_error', {
        topic: frame.topic || null,
        reason: frame.message || 'feed returned an error'
      });
      if (!frame.topic || topicSymbols.has(frame.topic)) ws.close(1011, 'feed error');
      return;
    }

    if (!topicSymbols.has(frame.topic)) return;
    const expectedSymbol = topicSymbols.get(frame.topic);

    const normalized = normalizeQuoteFrame(frame, {
      expectedSymbol,
      receivedAt: new Date(now())
    });
    for (const skipped of normalized.skipped) {
      safeLog('warn', 'quote_skipped', skipped);
    }
    for (const status of normalized.marketStatuses) {
      if (status.status !== lastMarketStatus) {
        lastMarketStatus = status.status;
        if (['CLS', 'SUS'].includes(status.status)) {
          safeLog('info', 'market_not_open', status);
        } else {
          safeLog('info', 'market_status', status);
        }
      }
    }

    for (let index = 0; index < normalized.events.length; index += 1) {
      const event = normalized.events[index];
      const classification = orderGuard.inspect(event);
      if (classification) {
        safeLog('info', `quote_${classification}`, {
          symbol: event.symbol,
          sourceTimestamp: event.sourceTimestamp
        });
        continue;
      }

      try {
        writeLine(JSON.stringify(event));
      } catch (error) {
        safeLog('error', 'output_failed', { reason: error.message });
        ws.close(1011, 'output failed');
        return;
      }

      lastQuoteAt = now();
      staleWarned = false;
      try {
        Promise.resolve(onQuote({ event, details: normalized.details[index] || null }))
          .catch((error) => safeLog('error', 'quote_sink_failed', { reason: error.message, symbol: event.symbol }));
      } catch (error) {
        safeLog('error', 'quote_sink_failed', { reason: error.message, symbol: event.symbol });
      }
      safeLog('info', 'quote_written', {
        symbol: event.symbol,
        sourceLagMs: sourceLagMs(event),
        marketStatus: lastMarketStatus
      });
    }
  };

  async function connect() {
    if (stopped || socket) return;
    try {
      const response = await fetchImpl(new URL('/api/init', origin), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) throw new Error(`init endpoint returned HTTP ${response.status}`);
      const body = await response.json();
      if (typeof body?.token !== 'string' || !body.token) {
        throw new Error('init endpoint did not return a token');
      }
      if (stopped) return;

      const ws = new WebSocketImpl(socketUrlFor(body.token), {
        headers: { Origin: origin }
      });
      socket = ws;
      ws.on('open', () => {
        lastFrameAt = now();
        safeLog('info', 'connected', { symbols: normalizedSymbols, market: normalizedMarket });
        clearSocketTimers();
        heartbeatTimer = setInterval(() => {
          if (lastFrameAt != null && now() - lastFrameAt > heartbeatTimeoutMs) {
            safeLog('warn', 'heartbeat_timeout', { symbols: normalizedSymbols });
            ws.close(4000, 'heartbeat timeout');
          }
        }, Math.min(15_000, heartbeatTimeoutMs));
      });
      ws.on('message', (raw) => handleFrame(ws, raw));
      ws.on('error', () => {
        safeLog('warn', 'socket_error', { symbols: normalizedSymbols });
      });
      ws.on('close', (code) => {
        clearSocketTimers();
        if (socket === ws) socket = null;
        if (!stopped) scheduleReconnect(`socket_closed_${code}`);
      });
    } catch (error) {
      safeLog('warn', 'connection_failed', { reason: error.message });
      scheduleReconnect('connection_failed');
    }
  }

  return {
    start() {
      if (stopped) throw new Error('Scraper has been stopped');
      if (!staleTimer) {
        staleTimer = setInterval(() => {
          if (
            lastQuoteAt != null
            && now() - lastQuoteAt > staleAfterMs
            && !staleWarned
          ) {
            staleWarned = true;
            safeLog('warn', 'data_stale', {
              symbols: normalizedSymbols,
              staleForMs: now() - lastQuoteAt,
              marketStatus: lastMarketStatus
            });
          }
        }, Math.min(staleAfterMs, 5_000));
      }
      void connect();
    },
    stop() {
      stopped = true;
      if (retryTimer) clearTimeoutImpl(retryTimer);
      retryTimer = null;
      if (staleTimer) clearInterval(staleTimer);
      staleTimer = null;
      clearSocketTimers();
      if (socket) socket.close(1000, 'scraper stopped');
      socket = null;
    },
    get topics() {
      return [...topics];
    }
  };
}

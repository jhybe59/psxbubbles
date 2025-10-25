import { useEffect, useRef, useState, useCallback } from 'react';
import storage from '../lib/storage';

const WS_URL = 'wss://psxterminal.com/';
const DEFAULT_MARKET = 'REG';
// API base resolution order:
// 1. If VITE_API_BASE is provided (in .env), use it (useful for pointing to a local psx-terminal clone)
// 2. In dev, use relative '/api' so Vite devServer proxy can forward to the live API
// 3. Otherwise use the live PSX API
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
  ? import.meta.env.VITE_API_BASE.replace(/\/$/, '')
  : ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) ? '/api' : 'https://psxterminal.com/api');

function fmtSnapshotFromTick(tick) {
  return {
    symbol: tick.s || tick.symbol,
    market: tick.m || tick.market || DEFAULT_MARKET,
    ts: tick.t || Date.now(), // milliseconds
    price: tick.c != null ? Number(tick.c) : (tick.price != null ? Number(tick.price) : null),
    volume: tick.v != null ? tick.v : (tick.volume != null ? tick.volume : null),
    value: tick.val != null ? tick.val : (tick.value != null ? tick.value : null),
    raw: tick
  };
}

export function useStocks({ enabled = true, market = DEFAULT_MARKET, retentionDays = 1 } = {}) {
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const latestRef = useRef(new Map());
  const [stocks, setStocks] = useState([]); // latest snapshots
  const [lastUpdated, setLastUpdated] = useState(null);
  const [connected, setConnected] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState({ running: false, total: 0, done: 0, current: null, errors: 0, lastError: null });

  useEffect(() => {
    storage.initDB().then(() => {
      // purge older than retentionDays
      const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      storage.purgeOlderThan(cutoff).catch(() => {});
    });
  }, [retentionDays]);

  // if dev/test: auto-run backfill when URL contains ?autobackfill=1
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.location && window.location.search && window.location.search.includes('autobackfill=1')) {
        // defer until hook defines backfill24h (below)
        // we'll call the exported backfill after render via a short timeout
        setTimeout(() => {
          if (typeof window.__AUTO_BACKFILL_RUN === 'function') {
            try { window.__AUTO_BACKFILL_RUN(); } catch (e) {}
          }
        }, 500);
      }
    } catch (e) {}
  }, []);

  const handleMessage = useCallback(async (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (!msg) return;
      if (msg.type === 'tickUpdate' && msg.tick) {
        const snap = fmtSnapshotFromTick(msg.tick);
        // save snapshot
        storage.saveSnapshots([snap]).catch(() => {});
        // update latest map
        const cur = latestRef.current.get(snap.symbol);
        if (!cur || snap.ts >= cur.ts) {
          latestRef.current.set(snap.symbol, snap);
        }
        // update state in batches (throttle)
        setLastUpdated(Date.now());
        // quick update: take top 500 latest
        const arr = Array.from(latestRef.current.values()).slice(0, 1000);
        setStocks(arr);
      } else if (msg.type === 'welcome') {
        // ignore
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) return;
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        // subscribe to market data
        const req = { type: 'subscribe', subscriptionType: 'marketData', params: { marketType: market }, requestId: 'req-1' };
        ws.send(JSON.stringify(req));
      };
      ws.onmessage = handleMessage;
      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // attempt reconnect with backoff
        if (!reconnectRef.current) reconnectRef.current = setTimeout(() => { reconnectRef.current = null; connect(); }, 2000 + Math.random() * 4000);
      };
      ws.onerror = () => {
        try { ws.close(); } catch (e) {}
      };
    } catch (e) {
      wsRef.current = null;
    }
  }, [handleMessage, market]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (enabled) connect();
    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // compute percent change for a symbol and interval (ms)
  const getIntervalValue = useCallback(async (symbol, intervalMs) => {
    const latest = latestRef.current.get(symbol) || null;
    if (!latest) return null;
    const nowTs = latest.ts || Date.now();
    const targetTs = nowTs - intervalMs;
    const prior = await storage.getSnapshotAtOrBefore(symbol, targetTs);
    if (!prior || !prior.price || !latest.price) return null;
    const pct = ((latest.price - prior.price) / prior.price) * 100;
    return pct;
  }, []);

  // compute values for all symbols for a given interval (ms)
  const computeAll = useCallback(async (intervalMs) => {
    const out = new Map();
    const latestArr = Array.from(latestRef.current.values());
    // parallel queries but limited
    const promises = latestArr.map(async (l) => {
      const prior = await storage.getSnapshotAtOrBefore(l.symbol, (l.ts || Date.now()) - intervalMs);
      if (!prior || !prior.price || !l.price) return [l.symbol, null];
      const pct = ((l.price - prior.price) / prior.price) * 100;
      return [l.symbol, pct];
    });
    const results = await Promise.all(promises);
    for (const [sym, val] of results) out.set(sym, val);
    return out;
  }, []);

  // backfill 24h baseline values for symbols (uses /api/klines). This will
  // fetch recent klines for each symbol and write one or more historical
  // snapshots into IndexedDB so interval calculations (24h, 1h, etc.) can
  // return immediately.
  const backfill24h = useCallback(async ({ symbols = null, batchSize = 10, delayMs = 800 } = {}) => {
    if (backfillStatus.running) return;
    setBackfillStatus({ running: true, total: 0, done: 0, current: null, errors: 0 });
    try {
      // choose symbol list
      let syms = symbols;
      if (!syms) {
        // try in-memory latest, else storage
        const inMem = Array.from(latestRef.current.keys());
        if (inMem && inMem.length) syms = inMem;
        else {
          const stored = await storage.getLatestAll();
          syms = stored.map(s => s.symbol);
        }
      }
      syms = Array.from(new Set(syms)).filter(Boolean);
      // if no symbols available locally, fetch a symbol list from the API (fallback)
      if (!syms || syms.length === 0) {
        try {
          const resp = await fetch(`${API_BASE}/symbols`, { cache: 'no-store' });
          if (resp && resp.status < 400) {
            const body = await resp.json();
            // body may be array, or may be wrapped like { success: true, data: [...] }
            const list = Array.isArray(body) ? body : (body && Array.isArray(body.data) ? body.data : null);
            if (Array.isArray(list) && list.length) {
              const derived = list.map((it) => {
                if (!it) return null;
                if (typeof it === 'string') return it;
                return it.symbol || it.id || it.ticker || it.name || null;
              }).filter(Boolean);
              if (derived.length) syms = derived.slice(0, 500); // cap for safety
            }
          } else {
            setBackfillStatus((s) => ({ ...s, lastError: `symbols fetch failed: ${resp ? resp.status : 'no-resp'}` }));
          }
        } catch (e) {
          setBackfillStatus((s) => ({ ...s, lastError: String(e && e.message ? e.message : e) }));
        }
      }
      setBackfillStatus((s) => ({ ...s, total: syms.length, lastError: s.lastError || null }));

      // helper to try parsing klines shape
      const parseKlineEntry = (entry) => {
        // handle object shapes
        if (!entry) return null;
        if (typeof entry === 'object' && !Array.isArray(entry)) {
          const ts = entry.t || entry.ts || entry.open_time || entry[0] || Date.now();
          const close = entry.c || entry.close || entry.close_price || null;
          const vol = entry.v || entry.volume || entry.q || null;
          return { ts, close: close != null ? Number(close) : null, volume: vol };
        }
        // array shape: [ts, open, high, low, close, volume]
        if (Array.isArray(entry)) {
          const ts = entry[0] || Date.now();
          const close = entry[4] != null ? Number(entry[4]) : null;
          const vol = entry[5] || null;
          return { ts, close, volume: vol };
        }
        return null;
      };

      const makeFetchFor = async (sym) => {
        // try minute klines for last 24h first
        const enc = encodeURIComponent(sym);
        const endpoints = [
          `${API_BASE}/klines/${enc}/1m?limit=1440`,
          `${API_BASE}/klines/${enc}/1h?limit=48`,
          `${API_BASE}/klines/${enc}/1d?limit=2`
        ];
        for (const url of endpoints) {
          try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res || res.status >= 400) continue;
            const j = await res.json();
            if (!j || !Array.isArray(j) || j.length === 0) continue;
            // pick the earliest entry from the response as the '24h ago' sample
            // or the second-to-last for daily endpoints
            let candidate = null;
            if (url.includes('/1d')) {
              // daily, use the previous day's close if available
              candidate = j.length >= 2 ? j[j.length - 2] : j[0];
            } else {
              // minute/hour: pick earliest (oldest) point
              candidate = j[0];
            }
            const parsed = parseKlineEntry(candidate);
            if (!parsed || parsed.close == null) continue;
            const snap = {
              symbol: sym,
              market: market,
              ts: parsed.ts || Date.now() - 24 * 60 * 60 * 1000,
              price: parsed.close,
              volume: parsed.volume || null,
              raw: { source: 'backfill', endpoint: url, sample: candidate }
            };
            await storage.saveSnapshots([snap]);
            // update in-memory latestRef if older than saved (do not override newer live ticks)
            const cur = latestRef.current.get(sym);
            if (!cur || (snap.ts && snap.ts > cur.ts)) latestRef.current.set(sym, snap);
            return { ok: true };
          } catch (e) {
            // try next endpoint
            continue;
          }
        }
        return { ok: false };
      };

      // process in batches
      for (let i = 0; i < syms.length; i += batchSize) {
        const batch = syms.slice(i, i + batchSize);
        // run fetches in parallel for this batch
        const promises = batch.map(async (s) => {
          setBackfillStatus((st) => ({ ...st, current: s }));
          try {
            const r = await makeFetchFor(s);
            setBackfillStatus((st) => ({ ...st, done: st.done + 1, errors: st.errors + (r.ok ? 0 : 1) }));
            return r;
          } catch (e) {
            setBackfillStatus((st) => ({ ...st, done: st.done + 1, errors: st.errors + 1 }));
            return { ok: false };
          }
        });
        await Promise.all(promises);
        // small delay between batches to avoid hitting rate limits
        if (i + batchSize < syms.length) await new Promise((res) => setTimeout(res, delayMs));
      }
    } catch (e) {
      // top-level failure
    } finally {
      setBackfillStatus((s) => ({ ...s, running: false, current: null }));
    }
  }, [market, backfillStatus.running]);

  // expose auto-run helper for dev: window.__AUTO_BACKFILL_RUN will call our backfill
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.__AUTO_BACKFILL_RUN = async (opts = {}) => {
          try {
            await backfill24h({ batchSize: opts.batchSize || 30, delayMs: opts.delayMs || 600, symbols: opts.symbols || null });
          } catch (e) {}
        };
      }
    } catch (e) {}
  }, [backfill24h]);

  // helper: fetch symbols from PSX API and report result (useful for debug)
  const fetchSymbols = useCallback(async () => {
    const attempts = [];
    // Attempt 1: relative /api proxy (dev)
    try {
      const resp = await fetch(`${API_BASE}/symbols`, { cache: 'no-store' });
      const status = resp ? resp.status : 'no-resp';
      let body = null;
      try { body = await resp.clone().json(); } catch (e) { body = await resp.clone().text().catch(() => null); }
      // normalize list shapes (array or { data: [] })
      const list = Array.isArray(body) ? body : (body && Array.isArray(body.data) ? body.data : null);
      attempts.push({ method: 'proxy', url: `${API_BASE}/symbols`, ok: resp && resp.status < 400, status, body: Array.isArray(list) ? (list.length > 10 ? `[${list.length} items]` : list) : body });
      if (resp && resp.status < 400 && Array.isArray(list)) {
        const derived = list.map((it) => (typeof it === 'string' ? it : (it && (it.symbol || it.id || it.ticker || it.name)))).filter(Boolean);
        setBackfillStatus((s) => ({ ...s, lastError: null }));
        return { ok: true, symbols: derived, attempts };
      }
    } catch (e) {
      attempts.push({ method: 'proxy', url: `${API_BASE}/symbols`, ok: false, error: String(e && e.message ? e.message : e) });
    }

    // Attempt 2: direct absolute HTTPS (may be blocked by CORS in browser)
    try {
      const abs = 'https://psxterminal.com/api/symbols';
      const resp = await fetch(abs, { cache: 'no-store' });
      const status = resp ? resp.status : 'no-resp';
      let body = null;
      try { body = await resp.clone().json(); } catch (e) { body = await resp.clone().text().catch(() => null); }
      const list = Array.isArray(body) ? body : (body && Array.isArray(body.data) ? body.data : null);
      attempts.push({ method: 'direct', url: abs, ok: resp && resp.status < 400, status, body: Array.isArray(list) ? (list.length > 10 ? `[${list.length} items]` : list) : body });
      if (resp && resp.status < 400 && Array.isArray(list)) {
        const derived = list.map((it) => (typeof it === 'string' ? it : (it && (it.symbol || it.id || it.ticker || it.name)))).filter(Boolean);
        setBackfillStatus((s) => ({ ...s, lastError: null }));
        return { ok: true, symbols: derived, attempts };
      }
    } catch (e) {
      attempts.push({ method: 'direct', url: 'https://psxterminal.com/api/symbols', ok: false, error: String(e && e.message ? e.message : e) });
    }

    // Attempt 3: network check to a public CORS-friendly endpoint to ensure browser outbound connectivity
    try {
      const test = 'https://api.ipify.org?format=json';
      const resp = await fetch(test, { cache: 'no-store' });
      const status = resp ? resp.status : 'no-resp';
      const body = await resp.clone().json().catch(() => null);
      attempts.push({ method: 'network-check', url: test, ok: resp && resp.status < 400, status, body });
    } catch (e) {
      attempts.push({ method: 'network-check', url: 'https://api.ipify.org?format=json', ok: false, error: String(e && e.message ? e.message : e) });
    }

    // (No further fallback) -- all attempts done

    const lastError = attempts.filter(a => !a.ok).map(a => `${a.method}:${a.error||a.status||'failed'}`).join(' | ');
    setBackfillStatus((s) => ({ ...s, lastError: lastError || 'unknown' }));
    return { ok: false, attempts, error: lastError };
  }, []);

  return {
    stocks,
    lastUpdated,
    connected,
    backfillStatus,
    backfill24h,
    fetchSymbols,
    getIntervalValue,
    computeAll,
    start: connect,
    stop: disconnect
  };
}

export default useStocks;

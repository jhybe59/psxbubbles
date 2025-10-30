import { useEffect, useState, useRef } from 'react';

// Minimal demo-only stocks hook.
// This hook intentionally avoids any upstream network calls and returns a
// static demo dataset so the app runs purely on local/demo data.

const DEFAULT_MARKET = 'REG';
const DEMO_SYMBOLS = [
  'AABS','AASM','ABL','ACI','ALNRS','BETA','CORN','DOR','ECHO','FION'
];

function makeDemoSnapshot(symbol) {
  const now = Date.now();
  const base = Math.max(0.01, (symbol.charCodeAt(0) % 50) + Math.random() * 10);
  return {
    symbol,
    market: DEFAULT_MARKET,
    ts: now,
    price: Number((base + Math.random() * 2 - 1).toFixed(4)),
    volume: Math.round(Math.random() * 10000),
    raw: { source: 'demo' }
  };
}

export function useStocks({ enabled = true } = {}) {
  const latestRef = useRef(new Map());
  const [stocks, setStocks] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [backfillStatus, setBackfillStatus] = useState({ running: false, total: 0, done: 0, current: null, errors: 0, lastError: null });

  useEffect(() => {
    // initialize demo snapshots
    DEMO_SYMBOLS.forEach((s) => latestRef.current.set(s, makeDemoSnapshot(s)));
    setStocks(Array.from(latestRef.current.values()));
    setLastUpdated(Date.now());
  }, []);

  // no-op: demo-only backfill (keeps API shape but does nothing)
  const backfill24h = async () => {
    setBackfillStatus({ running: false, total: 0, done: 0, current: null, errors: 0, lastError: 'disabled in demo mode' });
    return { ok: false, message: 'backfill disabled in demo-only mode' };
  };

  const fetchSymbols = async () => ({ ok: true, symbols: DEMO_SYMBOLS.slice() });

  const getIntervalValue = async () => null;
  const computeAll = async () => new Map();

  // start/stop are no-ops for demo
  const start = () => {};
  const stop = () => {};

  return {
    stocks,
    lastUpdated,
    connected: false,
    backfillStatus,
    backfill24h,
    fetchSymbols,
    getIntervalValue,
    computeAll,
    start,
    stop
  };
}

export default useStocks;

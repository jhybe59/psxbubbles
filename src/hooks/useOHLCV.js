import { useEffect, useState, useCallback, useRef } from 'react';
import storage from '../lib/storage';
import { ENABLE_REPO_SNAPSHOTS, ENABLE_LIVE_API, LIVE_API_BASE_URL, LIVE_API_KEY } from '../config';
import useMarketData from './useMarketData';

// Store volume history for calculating avg_volume (10-period SMA)
const volumeHistory = new Map(); // Map<symbol, number[]>
const HISTORY_LENGTH = 10;

function addVolumeToHistory(symbol, volume) {
  if (!volumeHistory.has(symbol)) {
    volumeHistory.set(symbol, []);
  }
  const history = volumeHistory.get(symbol);
  history.push(volume);
  // Keep only last 10 entries
  if (history.length > HISTORY_LENGTH) {
    history.shift();
  }
}

function getAvgVolume(symbol) {
  const history = volumeHistory.get(symbol);
  if (!history || history.length === 0) return 0;
  const sum = history.reduce((a, b) => a + b, 0);
  return sum / history.length;
}

// mapping of friendly interval -> trading-day count
const INTERVAL_LOOKUP = {
  'Day': 1,
  'Week': 5,
  'Month': 22,
  'Year': 252
};

const LIVE_INTERVAL_MAP = {
  '1 Min': '1m',
  '5 Min': '5m',
  '15 Min': '15m',
  'Hour': '1h',
  'Day': 'Day',
  'Week': 'Day',
  'Month': 'Day',
  'Year': 'Day',
  // Tick-based intervals
  '10 Ticks': '10t',
  '20 Ticks': '20t',
  '50 Ticks': '50t',
  '100 Ticks': '100t',
  '500 Ticks': '500t',
  '1000 Ticks': '1000t'
};

const fallbackName = (symbol) => (symbol || '').toUpperCase();

// ========== VOLATILITY & RVOL HELPERS ==========

// Safe division to avoid Infinity/NaN
function safeDiv(n, d, fallback = 0) {
  if (!isFinite(d) || Math.abs(d) < 1e-8) return fallback;
  return n / d;
}

// True Range for one candle
function trueRange(high, low, prevClose) {
  const tr1 = high - low;
  const tr2 = Math.abs(high - (prevClose ?? high));
  const tr3 = Math.abs(low - (prevClose ?? low));
  return Math.max(tr1, tr2, tr3);
}

// Volatility as percentage (uses prevClose as denominator for robustness)
function volatilityPct(high, low, close, prevClose) {
  const tr = trueRange(high, low, prevClose);
  // Use prevClose as denominator (more stable than low)
  // Fall back to typical price if prevClose not available
  let denom = prevClose;
  if (!denom || Math.abs(denom) < 1e-8) {
    denom = (high + low + close) / 3; // typical price
  }
  if (!denom || Math.abs(denom) < 1e-8) denom = 1;
  return (tr / denom) * 100;
}

// Store previous candle data for prev_volatility and prev_rvol calculation
const prevCandleHistory = new Map(); // Map<symbol, {high, low, close, volatility, rvol}[]>
const PREV_CANDLE_HISTORY_LENGTH = 3; // Need at least 3 for prev_prev

function addToPrevCandleHistory(symbol, candle) {
  if (!prevCandleHistory.has(symbol)) {
    prevCandleHistory.set(symbol, []);
  }
  const history = prevCandleHistory.get(symbol);
  history.push(candle);
  if (history.length > PREV_CANDLE_HISTORY_LENGTH) {
    history.shift();
  }
}

function getPrevCandleData(symbol, offset = 1) {
  const history = prevCandleHistory.get(symbol);
  if (!history || history.length < offset + 1) return null;
  return history[history.length - 1 - offset];
}


async function fetchLiveInterval(interval) {
  const apiInterval = LIVE_INTERVAL_MAP[interval] || LIVE_INTERVAL_MAP.Day;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const base = LIVE_API_BASE_URL.startsWith('http')
    ? LIVE_API_BASE_URL
    : `${origin}${LIVE_API_BASE_URL.startsWith('/') ? '' : '/'}${LIVE_API_BASE_URL}`;
  const url = new URL('bubbles', base.endsWith('/') ? base : `${base}/`);
  url.searchParams.set('interval', apiInterval);
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
  if (LIVE_API_KEY) headers['x-api-key'] = LIVE_API_KEY;

  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      // Add timestamp to URL to bypass browser cache
      url.searchParams.set('_t', Date.now().toString());
      const res = await fetch(url.toString(), {
        headers,
        cache: 'no-store'
      });

      if (res.status === 429) {
        attempt++;
        if (attempt > MAX_RETRIES) throw new Error(`Live API rate limit exceeded (${res.status})`);
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`[useOHLCV] Rate limit hit, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!res.ok) {
        throw new Error(`Live API error (${res.status})`);
      }

      const json = await res.json();
      // Support both old format (json.symbols) and new format (json.data)
      const symbols = json.symbols || json.data;
      if (!json || !Array.isArray(symbols)) {
        return [];
      }
      return symbols.map((row) => {
        const price = Number(row.price ?? row.close ?? 0);
        const open = row.open != null ? Number(row.open) : (row.price || 0);
        const high = row.high != null ? Number(row.high) : (row.price || 0);
        const low = row.low != null ? Number(row.low) : (row.price || 0);
        // Support both old (intervalPct) and new (pct_interval) field names
        const changePct = Number(row.intervalPct ?? row.pct_interval ?? 0);

        const prevClose = price / (1 + changePct / 100);

        // Calculate Volatility using robust helper (prevClose as denominator)
        const hasRangeData = high !== price || low !== price;
        const volatility = hasRangeData ? volatilityPct(high, low, price, prevClose) : 0;

        // Calculate Relative Volume using 10-period SMA
        const volume = Number(row.volume || 0);
        addVolumeToHistory(row.symbol, volume);
        const avgVolume = getAvgVolume(row.symbol);
        const relative_volume = safeDiv(volume, avgVolume, 1.0);

        // Get previous candle data for prev_volatility and prev_rvol
        const prevCandle = getPrevCandleData(row.symbol, 0); // offset 0 = previous (before we add current)
        const prevPrevCandle = getPrevCandleData(row.symbol, 1); // offset 1 = 2 candles back

        // Store current candle for next iteration
        addToPrevCandleHistory(row.symbol, {
          high, low, close: price, open,
          volatility, rvol: relative_volume, volume
        });

        return {
          id: row.symbol,
          symbol: row.symbol,
          name: row.name || fallbackName(row.symbol),
          price: price,
          open: open,
          high: high,
          low: low,
          volume: volume,
          avg_volume: avgVolume,
          price_change_percentage_24h: changePct,
          // Support both old (dailyPct) and new (pct_24h) field names
          daily_change_1d: row.dailyPct != null ? Number(row.dailyPct) : (row.pct_24h != null ? Number(row.pct_24h) : null),
          // Add 24h volume for tooltip
          day_volume: row.day_volume != null ? Number(row.day_volume) : null,
          volatility: row.vol_atr_pct != null ? Number(row.vol_atr_pct) : volatility,
          relative_volume: relative_volume,
          // Volatility Engine Metrics
          squeeze_on: row.squeeze_on ?? false,
          bb_width: row.bb_width ? Number(row.bb_width) : null,
          kc_width: row.kc_width ? Number(row.kc_width) : null,
          vol_atr: row.vol_atr ? Number(row.vol_atr) : null,
          vol_atr_pct: row.vol_atr_pct ? Number(row.vol_atr_pct) : null,
          vol_stddev: row.vol_stddev ? Number(row.vol_stddev) : null,
          // Previous volatility and RVOL for momentum confirmation
          prev_volatility: prevCandle?.volatility ?? null,
          prev_rvol: prevCandle?.rvol ?? null,
          ts: row.ts ? Number(new Date(row.ts).getTime()) : null,
          // Previous bar data for breakout detection
          prev_close: row.prevClose != null ? Number(row.prevClose) : (row.prev_close != null ? Number(row.prev_close) : null),
          prev_open: row.prevOpen != null ? Number(row.prevOpen) : (row.prev_open != null ? Number(row.prev_open) : null),
          prev_high: row.prevHigh != null ? Number(row.prevHigh) : (row.prev_high != null ? Number(row.prev_high) : null),
          prev_low: row.prevLow != null ? Number(row.prevLow) : (row.prev_low != null ? Number(row.prev_low) : null),
          prev_volume: row.prevVolume != null ? Number(row.prevVolume) : (row.prev_volume != null ? Number(row.prev_volume) : null),
          // 2-candles back for strong breakout confirmation
          prev_prev_high: prevPrevCandle?.high ?? null,
          prev_prev_low: prevPrevCandle?.low ?? null,
          prev_prev_close: prevPrevCandle?.close ?? null,
          prev_prev_open: prevPrevCandle?.open ?? null,
          // Lookback stats for flexible strategy builder
          lookback: row.lookback || {},
          raw: row,
          // Session alerts from backend
          alerts: row.alerts || [],
          // Breakout detection from backend
          breakout_signal: row.breakout_signal ?? false,
          breakout_type: row.breakout_type ?? null,
          // Live Lead Metrics
          lead_metrics: row.lead_metrics,
        };
      });
    } catch (err) {
      if (attempt >= MAX_RETRIES) throw err;
      attempt++;
      // Simple retry for network errors
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return [];
}

/**
 * Fetch tick-based interval data from /api/tick-bubbles
 * @param {string} interval - One of '10 Ticks', '100 Ticks', '500 Ticks', '1000 Ticks'
 */
async function fetchTickInterval(interval) {
  // Extract tick count from interval string (e.g., '100 Ticks' -> 100)
  const tickMatch = interval.match(/^(\d+)\s*Ticks?$/i);
  if (!tickMatch) {
    console.warn('[useOHLCV] Invalid tick interval:', interval);
    return [];
  }
  const tickCount = parseInt(tickMatch[1], 10);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const base = LIVE_API_BASE_URL.startsWith('http')
    ? LIVE_API_BASE_URL
    : `${origin}${LIVE_API_BASE_URL.startsWith('/') ? '' : '/'}${LIVE_API_BASE_URL}`;
  const url = new URL('tick-bubbles', base.endsWith('/') ? base : `${base}/`);
  url.searchParams.set('ticks', tickCount.toString());
  url.searchParams.set('_t', Date.now().toString());

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };
  if (LIVE_API_KEY) headers['x-api-key'] = LIVE_API_KEY;

  try {
    const res = await fetch(url.toString(), { headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`Tick API error (${res.status})`);

    const json = await res.json();
    if (!Array.isArray(json)) return [];

    return json.map((row) => {
      const price = Number(row.close ?? row.price ?? 0);
      const changePct = Number(row.pct_interval ?? 0);

      return {
        id: row.symbol,
        symbol: row.symbol,
        name: row.name || fallbackName(row.symbol),
        price: price,
        open: Number(row.open ?? price),
        high: Number(row.high ?? price),
        low: Number(row.low ?? price),
        volume: Number(row.volume ?? 0),
        avg_volume: 0,
        price_change_percentage_24h: changePct,
        daily_change_1d: row.pct_24h != null ? Number(row.pct_24h) : null,
        day_volume: row.day_volume != null ? Number(row.day_volume) : null,
        day_volume: row.day_volume != null ? Number(row.day_volume) : null,
        // Map RVOL correctly from API response
        rvol: row.rvol != null ? Number(row.rvol) : 0,
        relative_volume: row.rvol != null ? Number(row.rvol) : 0,
        volatility: row.vol_atr_pct != null ? Number(row.vol_atr_pct) : (row.volatility != null ? Number(row.volatility) : 0),
        // Volatility Engine Metrics
        squeeze_on: row.squeeze_on ?? false,
        bb_width: row.bb_width ? Number(row.bb_width) : null,
        kc_width: row.kc_width ? Number(row.kc_width) : null,
        vol_atr: row.vol_atr ? Number(row.vol_atr) : null,
        vol_atr_pct: row.vol_atr_pct ? Number(row.vol_atr_pct) : null,
        vol_stddev: row.vol_stddev ? Number(row.vol_stddev) : null,
        ts: row.ts ? new Date(row.ts).getTime() : null,
        // Tick-specific fields
        tickInterval: tickCount,
        timeElapsedMs: row.timeElapsedMs ?? null,
        startTs: row.startTs ? new Date(row.startTs).getTime() : null,
        tickCount: row.tickCount ?? tickCount,
        raw: row,
        // Session alerts from backend
        alerts: row.alerts || [],
        // Breakout detection from backend
        breakout_signal: row.breakout_signal ?? false,
        breakout_type: row.breakout_type ?? null,
        // Live Lead Metrics
        lead_metrics: row.lead_metrics
      };
    });
  } catch (err) {
    console.error('[useOHLCV] fetchTickInterval error:', err);
    return [];
  }
}

export default function useOHLCV() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [latestTimestamp, setLatestTimestamp] = useState(null);
  const [currentInterval, setCurrentInterval] = useState('Day');
  const [socketConnected, setSocketConnected] = useState(false);

  // Ref for stable access to coins in callbacks
  const coinsRef = useRef(coins);
  const currentIntervalRef = useRef(currentInterval);

  // Keep refs in sync with state
  useEffect(() => { coinsRef.current = coins; }, [coins]);
  useEffect(() => { currentIntervalRef.current = currentInterval; }, [currentInterval]);

  // ═══════════════════════════════════════════════════════════════════
  // REAL-TIME SOCKET.IO UPDATES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Handle real-time symbol update from Socket.IO
   * Updates ONLY the specific symbol, leaving all other bubbles untouched
   */
  const handleSymbolUpdate = useCallback((data) => {
    const { symbol, intervals } = data;
    if (!symbol || !intervals) return;

    // Get interval data for current selected interval
    const intervalKey = currentIntervalRef.current === 'Day' ? 'Day'
      : currentIntervalRef.current === 'Hour' ? '1h'
        : currentIntervalRef.current === '1 Min' ? '1m'
          : currentIntervalRef.current === '5 Min' ? '5m'
            : currentIntervalRef.current === '15 Min' ? '15m'
              : currentIntervalRef.current.includes('Ticks')
                ? currentIntervalRef.current.replace(' Ticks', 't').replace(' ', '')
                : 'Day';

    const intervalData = intervals[intervalKey];
    if (!intervalData) return;

    // Calculate percentage change
    const pctChange = intervalData.pct || 0;

    // Update ONLY this symbol in the coins array - SELECTIVE UPDATE
    setCoins(prev => {
      const idx = prev.findIndex(c =>
        (c.symbol || c.id || '').toUpperCase() === symbol.toUpperCase()
      );

      if (idx === -1) {
        // New symbol - but don't add during real-time (wait for full refresh)
        // This prevents partial data issues
        return prev;
      }

      // Existing symbol - update in place, preserving all other fields
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        price: intervalData.close || updated[idx].price,
        open: intervalData.open || updated[idx].open,
        high: intervalData.high || updated[idx].high,
        low: intervalData.low || updated[idx].low,
        volume: intervalData.volume || updated[idx].volume,
        price_change_percentage_24h: pctChange,
        // Enrichments from real-time data
        rvol: data.rvol ?? updated[idx].rvol,
        relative_volume: data.rvol ?? updated[idx].relative_volume,
        squeeze_on: data.squeeze_on ?? updated[idx].squeeze_on,
        bb_width: data.bb_width ?? updated[idx].bb_width,
        kc_width: data.kc_width ?? updated[idx].kc_width,
        orb_high_5m: data.orb_high_5m ?? updated[idx].orb_high_5m,
        orb_low_5m: data.orb_low_5m ?? updated[idx].orb_low_5m,
        orb_high_15m: data.orb_high_15m ?? updated[idx].orb_high_15m,
        orb_low_15m: data.orb_low_15m ?? updated[idx].orb_low_15m,
        breakout_signal: data.breakout_signal ?? updated[idx].breakout_signal,
        pre_breakout_signal: data.pre_breakout_signal ?? updated[idx].pre_breakout_signal,
        ts: data.ts || Date.now(),
        _lastSocketUpdate: Date.now()
      };
      return updated;
    });
  }, []);

  // Connect to Socket.IO for real-time updates
  const { connected: rtConnected, lastUpdate } = useMarketData(handleSymbolUpdate);

  // Track socket connection status
  useEffect(() => {
    setSocketConnected(rtConnected);
    if (rtConnected) {
      console.log('[useOHLCV] Real-time Socket.IO connected');
    }
  }, [rtConnected]);

  // Check database duration and hydrate volume history
  useEffect(() => {
    async function checkDB() {
      try {
        const timestamps = await storage.getAllTimestamps();
        if (timestamps.length > 0) {
          const minTs = timestamps[0];
          const maxTs = timestamps[timestamps.length - 1];
          const days = (maxTs - minTs) / (1000 * 60 * 60 * 24);
          console.log(`[Database Info] Data available for ${days.toFixed(2)} days`);
          console.log(`[Database Info] From: ${new Date(minTs).toLocaleString()} To: ${new Date(maxTs).toLocaleString()}`);
          console.log(`[Database Info] Total snapshots: ${timestamps.length}`);

          // Hydrate volume history from DB if empty
          if (volumeHistory.size === 0) {
            console.log('[Volume History] Hydrating from database...');
            const latest = await storage.getLatestAll();
            for (const row of latest) {
              const sym = row.symbol;
              // Get all history for this symbol
              const history = await storage.getRange(sym, 0, Date.now());
              // Extract volumes and sort by TS
              const volumes = history
                .sort((a, b) => a.ts - b.ts)
                .map(r => Number(r.volume || (r.v != null ? r.v : 0)))
                .filter(v => v > 0);

              // Take last 10
              const last10 = volumes.slice(-10);
              volumeHistory.set(sym, last10);
            }
            console.log(`[Volume History] Hydrated for ${volumeHistory.size} symbols`);
          }
        } else {
          console.log('[Database Info] No data found in database');
        }
      } catch (err) {
        console.error('[Database Info] Error checking DB:', err);
      }
    }
    checkDB();
  }, []);

  const importSnapshotsIfNeeded = useCallback(async (force = false) => {
    try {
      if (ENABLE_LIVE_API) {
        setSnapshotCount(null);
        return { imported: false, count: null };
      }

      const cnt = await storage.countSnapshots();
      // If repository-driven snapshots are disabled, do not auto-import from
      // public/psx_snapshots.json. Respect manual CSV uploads only.
      if (!ENABLE_REPO_SNAPSHOTS) {
        setSnapshotCount(cnt);
        return { imported: false, count: cnt };
      }
      if (!force && cnt && cnt > 0) {
        setSnapshotCount(cnt);
        return { imported: false, count: cnt };
      }
      setLoading(true);
      if (force && cnt && cnt > 0) {
        // clear DB to force a fresh import
        await storage.clearSnapshots();
      }
      // fetch prebuilt JSON (generated by scripts/generate_snapshots_json.cjs -> public/psx_snapshots.json)
      const res = await fetch('/psx_snapshots.json');
      if (!res.ok) throw new Error('Failed to fetch snapshots JSON');
      const list = await res.json();
      // If JSON is very large it likely contains full history; to avoid importing huge amounts
      // (and duplicate entries) collapse to latest-per-symbol when the file is enormous.
      let filteredList = list;
      if (Array.isArray(list) && list.length > 100000) {
        // keep only the latest timestamp record per symbol
        const latestBySymbol = new Map();
        for (const r of list) {
          const sym = r.symbol;
          const cur = latestBySymbol.get(sym);
          if (!cur || (r.ts || 0) > (cur.ts || 0)) latestBySymbol.set(sym, r);
        }
        filteredList = Array.from(latestBySymbol.values());
        console.info('[useOHLCV] large snapshots JSON detected; importing latest-per-symbol only', filteredList.length);
      } else {
        // remove exact duplicates (same symbol + ts) if any
        const seen = new Set();
        filteredList = list.filter((r) => {
          const k = `${r.symbol}|${r.ts}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (filteredList.length !== list.length) console.info('[useOHLCV] removed duplicate snapshot records', list.length - filteredList.length);
      }
      // convert to storage format
      const items = filteredList.map((r) => ({ symbol: r.symbol, market: r.market || 'PSX', ts: r.ts, price: r.price, volume: r.volume, value: null, raw: r }));
      // save in batches to avoid blocking
      const BATCH = 800;
      for (let i = 0; i < items.length; i += BATCH) {
        const chunk = items.slice(i, i + BATCH);
        await storage.saveSnapshots(chunk);
      }
      const finalCount = await storage.countSnapshots();
      setSnapshotCount(finalCount);
      setLoading(false);
      return { imported: true, count: finalCount };
    } catch (err) {
      setLoading(false);
      setError(err.message || String(err));
      return { imported: false, error: err.message };
    }
  }, []);

  const refreshForInterval = useCallback(async (interval = 'Day') => {
    setLoading(true);
    setError(null);
    // Update current interval so Socket.IO uses correct interval for updates
    setCurrentInterval(interval);
    try {
      if (ENABLE_LIVE_API) {
        // Check if this is a tick-based interval
        const isTickInterval = /^\d+\s*Ticks?$/i.test(interval);

        let liveCoins;
        if (isTickInterval) {
          // Use dedicated tick-bubbles API for tick intervals
          liveCoins = await fetchTickInterval(interval);
        } else {
          // Use standard bubbles API for time intervals
          liveCoins = await fetchLiveInterval(interval);
        }

        setCoins(liveCoins);
        setSnapshotCount(liveCoins.length);
        setLatestTimestamp(liveCoins.reduce((latest, row) => (row.ts && row.ts > latest ? row.ts : latest), null));
        setLoading(false);
        return liveCoins;
      }

      // ensure db has snapshots
      await importSnapshotsIfNeeded();
      // gather timestamps
      const tsList = await storage.getAllTimestamps();
      setSnapshotCount(await storage.countSnapshots());
      setLatestTimestamp(tsList && tsList.length ? tsList[tsList.length - 1] : null);
      if (!tsList || tsList.length === 0) {
        setCoins([]);
        setLoading(false);
        return;
      }
      const latestTs = tsList[tsList.length - 1];
      // latest index
      const latestIdx = tsList.length - 1;
      const lookback = INTERVAL_LOOKUP[interval] || 1;
      const targetIdx = Math.max(0, latestIdx - lookback);
      const earlierTs = tsList[targetIdx];

      // get latest snapshots (one per symbol)
      const latest = await storage.getLatestAll();
      // build coins
      const out = [];
      for (const row of latest) {
        const sym = row.symbol;
        const later = row; // latest entry for symbol
        const prev = await storage.getSnapshotAtOrBefore(sym, earlierTs);
        let intervalPct = null;
        if (prev && prev.price != null && prev.price !== 0 && later.price != null) {
          intervalPct = ((later.price - prev.price) / prev.price) * 100;
        }
        // determine daily percent from raw if present
        const dailyRaw = later && later.raw && (later.raw['Price Change % 1 day'] || later.raw['Price Change % 1 Day'] || later.raw['Price Change %'] || later.raw.daily_pct);
        const dailyPct = dailyRaw != null ? Number(dailyRaw) : null;

        const price = later.price;
        const open = later.raw?.open != null ? Number(later.raw.open) : later.price;
        const high = later.raw?.high != null ? Number(later.raw.high) : later.price;
        const low = later.raw?.low != null ? Number(later.raw.low) : later.price;

        // Calculate Volatility
        // For snapshots, we use the intervalPct (calculated from prev snapshot) as changePct
        const changePct = intervalPct || 0;
        const prevClose = price / (1 + changePct / 100);

        // Check if we have valid High/Low data
        const hasRangeData = high !== price || low !== price;

        let volatility = 0;
        if (hasRangeData) {
          const tr1 = high - low;
          const tr2 = Math.abs(high - prevClose);
          const tr3 = Math.abs(low - prevClose);
          const trueRange = Math.max(tr1, tr2, tr3);
          volatility = low > 0 ? (trueRange * 100 / low) : 0;
        }

        // Calculate Relative Volume
        const volume = Number(later.v || 0);

        // Add to history
        addVolumeToHistory(sym, volume);

        // Calculate average
        const avgVolume = getAvgVolume(sym);
        const relative_volume = avgVolume > 0 ? (volume / avgVolume) : 1.0;

        out.push({
          id: sym,
          symbol: sym,
          name: (later.raw && (later.raw.Description || later.raw.description)) || sym,
          price: price,
          open: open,
          high: high,
          low: low,
          volume: volume,
          avg_volume: avgVolume,
          // price_change_percentage_24h will represent the selected-interval percent (for display/color)
          price_change_percentage_24h: intervalPct,
          // keep daily change separate so bubble sizing can use it
          daily_change_1d: dailyPct,
          volatility: volatility,
          relative_volume: relative_volume,
          raw: later.raw,
          ts: later.ts
        });
      }
      setCoins(out.sort((a, b) => Math.abs(b.price_change_percentage_24h || 0) - Math.abs(a.price_change_percentage_24h || 0)));
      setLoading(false);
      return out;
    } catch (err) {
      setLoading(false);
      setError(err.message || String(err));
      return [];
    }
  }, [importSnapshotsIfNeeded]);

  useEffect(() => {
    (async () => {
      if (!ENABLE_LIVE_API) {
        await importSnapshotsIfNeeded();
      }
      await refreshForInterval('Day');
    })();
  }, [importSnapshotsIfNeeded, refreshForInterval]);

  return {
    coins,
    loading,
    error,
    importSnapshotsIfNeeded,
    refreshForInterval,
    snapCount: snapshotCount,
    latestTimestamp,
    // Real-time status
    socketConnected,
    lastSocketUpdate: lastUpdate
  };
}

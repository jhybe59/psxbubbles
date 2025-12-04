import { useEffect, useState, useCallback } from 'react';
import storage from '../lib/storage';
import { ENABLE_REPO_SNAPSHOTS, ENABLE_LIVE_API, LIVE_API_BASE_URL, LIVE_API_KEY } from '../config';

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
  'Year': 'Day'
};

const fallbackName = (symbol) => (symbol || '').toUpperCase();

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
      if (!json || !Array.isArray(json.symbols)) {
        return [];
      }
      return json.symbols.map((row) => {
        const price = Number(row.price ?? 0);
        const open = row.open != null ? Number(row.open) : (row.price || 0);
        const high = row.high != null ? Number(row.high) : (row.price || 0);
        const low = row.low != null ? Number(row.low) : (row.price || 0);
        const changePct = Number(row.intervalPct ?? 0);

        const prevClose = price / (1 + changePct / 100);

        // Check if we have valid High/Low data
        // If High and Low are exactly equal to Price, it means the API didn't provide them
        // In this case, True Range would just be the gap (change), so Volatility would == Performance
        // We want to avoid that.
        const hasRangeData = high !== price || low !== price;

        let volatility = 0;
        if (hasRangeData) {
          const tr1 = high - low;
          const tr2 = Math.abs(high - prevClose);
          const tr3 = Math.abs(low - prevClose);
          const trueRange = Math.max(tr1, tr2, tr3);
          volatility = low > 0 ? (trueRange * 100 / low) : 0;
        }

        // Calculate Relative Volume using 10-period SMA
        const volume = Number(row.volume || 0);

        // Add current volume to history
        addVolumeToHistory(row.symbol, volume);

        // Calculate average from history
        const avgVolume = getAvgVolume(row.symbol);
        const relative_volume = avgVolume > 0 ? (volume / avgVolume) : 1.0; // Default to 1.0 if no history



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
          daily_change_1d: row.dailyPct != null ? Number(row.dailyPct) : null,
          volatility: volatility,
          relative_volume: relative_volume,
          ts: row.ts ? Number(new Date(row.ts).getTime()) : null,
          // Previous bar data for breakout detection
          prev_close: row.prevClose != null ? Number(row.prevClose) : null,
          prev_open: row.prevOpen != null ? Number(row.prevOpen) : null,
          prev_high: row.prevHigh != null ? Number(row.prevHigh) : null,
          prev_low: row.prevLow != null ? Number(row.prevLow) : null,
          prev_volume: row.prevVolume != null ? Number(row.prevVolume) : null,
          // Lookback stats for flexible strategy builder
          lookback: row.lookback || {},
          raw: row
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

export default function useOHLCV() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [latestTimestamp, setLatestTimestamp] = useState(null);

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
    try {
      if (ENABLE_LIVE_API) {
        const liveCoins = await fetchLiveInterval(interval);
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
    latestTimestamp
  };
}

import React, { useEffect, useState, useRef } from 'react';
import storage from '../lib/storage';
import { ENABLE_REPO_SNAPSHOTS } from '../config';
import InteractiveChart from './InteractiveChart';
import { buildCandlesFromSnapshots } from '../lib/chartUtils';

// Icon/trade buttons removed for stock-focused UI

export default function CoinModal({ coin, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!coin) return null;

  const [timeframe, setTimeframe] = useState('Day');
  const [series, setSeries] = useState([]);
  const [ohlcSummary, setOhlcSummary] = useState(null);
  const [pillPctMap, setPillPctMap] = useState({});
  const [latestSnapshot, setLatestSnapshot] = useState(null);
  const [daily24hStats, setDaily24hStats] = useState(null);
  const [currentCoin, setCurrentCoin] = useState(coin);
  // only area chart is used now
  const INTERVAL_LOOKUP = { Hour: 1, Day: 1, Week: 5, Month: 22, Year: 252 };

  // Format large numbers with K/M abbreviations
  function formatLargeNumber(value) {
    if (value == null || value === '-' || !Number.isFinite(Number(value))) return value || '-';
    const num = Number(value);
    if (Math.abs(num) >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(2)}B`;
    }
    if (Math.abs(num) >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    }
    if (Math.abs(num) >= 1_000) {
      return `${(num / 1_000).toFixed(2)}K`;
    }
    return num.toFixed(0);
  }

  function toNum(v) {
    if (v == null || v === '') return null;
    const n = Number(String(v).replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function rawGet(raw, ...keys) {
    if (!raw) return null;
    for (const k of keys) {
      if (raw[k] != null && raw[k] !== '') return raw[k];
      const low = Object.keys(raw).find((rk) => rk.toLowerCase() === k.toLowerCase());
      if (low) return raw[low];
    }
    return null;
  }

  // compute pill percent using stored snapshots for that timeframe
  function computePillPct(tf, coinLocal) {
    try {
      const s = series;
      if (!s || s.length < 2) return '-';
      const first = s[0].close;
      const last = s[s.length - 1].close;
      if (first == null || first === 0) return '-';
      const pct = ((last - first) / first) * 100;
      return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    } catch (e) {
      return '-';
    }
  }

  useEffect(() => {
    let mounted = true;
    async function loadSeries() {
      if (!coin) return;
      try {
        const tsList = await storage.getAllTimestamps();
        if (!tsList || tsList.length === 0) {
          if (mounted) {
            setSeries([]);
            setOhlcSummary(null);
            setPillPctMap({});
          }
          return;
        }
        const latestTs = tsList[tsList.length - 1];
        const latestIdx = tsList.length - 1;
        const lookback = INTERVAL_LOOKUP[timeframe] || 1;
        const targetIdx = Math.max(0, latestIdx - lookback);
        const earlierTs = tsList[targetIdx];
        // fetch the latest snapshot for this symbol (to obtain fields like volume from CSV)
        try {
          const latestSnap = await storage.getSnapshotAtOrBefore(coin.symbol, latestTs);
          if (mounted) setLatestSnapshot(latestSnap);
        } catch (e) {
          if (mounted) setLatestSnapshot(null);
        }
        let rows = await storage.getRange(coin.symbol, earlierTs, latestTs);
        // If DB is empty for this symbol (snapshots not imported), optionally fall back to the public JSON
        if ((!rows || rows.length === 0) && ENABLE_REPO_SNAPSHOTS) {
          try {
            const res = await fetch('/psx_snapshots.json');
            if (res && res.ok) {
              const list = await res.json();
              const filtered = (list || []).filter((r) => (r && (r.symbol === coin.symbol) && (r.ts >= earlierTs) && (r.ts <= latestTs))).map((r) => ({ symbol: r.symbol, ts: r.ts, price: r.price, volume: r.volume, raw: r }));
              rows = filtered;
            }
          } catch (e) {
            // ignore fetch fallback errors
          }
        }
        rows.sort((a, b) => a.ts - b.ts);

        // Choose bucket size based on selected timeframe to produce useful OHLC candles
        const BUCKET_MS = {
          Hour: 5 * 60 * 1000, // 5 minutes
          Day: 60 * 60 * 1000, // 1 hour
          Week: 6 * 60 * 60 * 1000, // 6 hours
          Month: 24 * 60 * 60 * 1000, // 1 day
          Year: 7 * 24 * 60 * 60 * 1000 // 7 days
        };

        const bucketMs = BUCKET_MS[timeframe] || 60 * 60 * 1000;

        // If raw OHLC are missing, build candles from price samples using buckets
        let candles = buildCandlesFromSnapshots(rows.map(r => ({ ts: r.ts, price: r.price, volume: r.volume })), bucketMs);

        // buildCandlesFromSnapshots returns time in seconds; convert to ms for our UI
        const s = candles.map((c) => ({ ts: Number(c.time) * 1000, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })).filter((x) => x.close != null);
        if (mounted) {
          setSeries(s);
          if (s && s.length) {
            const open = s[0].open != null ? s[0].open : s[0].close;
            const close = s[s.length - 1].close;
            const low = Math.min(...s.map((z) => (z.low != null ? z.low : z.close)));
            const high = Math.max(...s.map((z) => (z.high != null ? z.high : z.close)));
            setOhlcSummary({ open, low, high, close });
            // compute percent for each pill (based on latest vs earlier snapshot for that lookback)
            const pctMap = {};
            await Promise.all(Object.keys(INTERVAL_LOOKUP).map(async (tf) => {
              try {
                const lb = INTERVAL_LOOKUP[tf] || 1;
                const tgt = Math.max(0, latestIdx - lb);
                const ets = tsList[tgt];
                const prev = await storage.getSnapshotAtOrBefore(coin.symbol, ets);
                const latestRow = await storage.getSnapshotAtOrBefore(coin.symbol, latestTs);
                if (prev && prev.price != null && prev.price !== 0 && latestRow && latestRow.price != null) {
                  const p = ((latestRow.price - prev.price) / prev.price) * 100;
                  pctMap[tf] = `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
                } else pctMap[tf] = '-';
              } catch (e) {
                pctMap[tf] = '-';
              }
            }));
            setPillPctMap(pctMap);
          } else setOhlcSummary(null);
        }
      } catch (err) {
        if (mounted) {
          setSeries([]);
          setOhlcSummary(null);
          setPillPctMap({});
        }
      }
    }
    loadSeries();
    return () => { mounted = false; };
  }, [coin, timeframe]);

  // Update currentCoin when coin prop changes (real-time updates)
  useEffect(() => {
    setCurrentCoin(coin);
  }, [coin]);

  // Define displayCoin BEFORE it's used in useEffect
  const displayCoin = currentCoin || coin;

  // Calculate 24h stats - prefer API-provided daily fields (most accurate)
  useEffect(() => {
    let mounted = true;
    async function load24hStats() {
      if (!coin || !coin.symbol) return;

      try {
        const raw = displayCoin?.raw || coin?.raw || {};

        // PRIORITY 1: Use API-provided daily fields (from backend SQL calculation)
        // These are guaranteed to be accurate 24h values regardless of selected interval
        const apiDailyHigh = displayCoin?.dailyHigh ?? coin?.dailyHigh ?? null;
        const apiDailyLow = displayCoin?.dailyLow ?? coin?.dailyLow ?? null;
        const apiDailyVolume = displayCoin?.dailyVolume ?? coin?.dailyVolume ?? null;
        const apiDailyValue = displayCoin?.dailyValue ?? coin?.dailyValue ?? null;
        const apiDailyOpen = displayCoin?.dailyOpen ?? coin?.dailyOpen ?? null;

        // PRIORITY 2: Fallback to raw data fields (from CSV/API)
        // Get values from raw data first (most accurate)
        // These fields come directly from CSV/API and are already calculated correctly
        const rawHigh = raw['High 1 day'] != null ? Number(raw['High 1 day']) :
          raw['High'] != null ? Number(raw['High']) :
            raw['high'] != null ? Number(raw['high']) : null;
        const rawLow = raw['Low 1 day'] != null ? Number(raw['Low 1 day']) :
          raw['Low'] != null ? Number(raw['Low']) :
            raw['low'] != null ? Number(raw['low']) : null;
        const rawVolume = raw['Volume 1 day'] != null ? Number(raw['Volume 1 day']) :
          raw['Volume'] != null ? Number(raw['Volume']) :
            raw['volume'] != null ? Number(raw['volume']) : null;
        const rawValue = raw['Turnover 1 day'] != null ? Number(raw['Turnover 1 day']) :
          raw['Turnover'] != null ? Number(raw['Turnover']) :
            raw['turnover'] != null ? Number(raw['turnover']) :
              raw['Value'] != null ? Number(raw['Value']) : null;
        const rawDailyPct = raw['Price Change % 1 day'] != null ? Number(raw['Price Change % 1 day']) :
          raw['Price Change % 1 Day'] != null ? Number(raw['Price Change % 1 Day']) :
            raw['Price Change %'] != null ? Number(raw['Price Change %']) :
              raw['daily_pct'] != null ? Number(raw['daily_pct']) : null;

        // Get current price
        const latestPrice = displayCoin?.price || coin?.price || null;

        // Calculate today's open price and price delta
        let todayOpenPrice = null;
        let priceDelta = null;

        // Try to get open price from raw data first
        const rawOpen = raw['Open 1 day'] != null ? Number(raw['Open 1 day']) :
          raw['Open'] != null ? Number(raw['Open']) :
            raw['open'] != null ? Number(raw['open']) : null;

        if (rawOpen != null) {
          todayOpenPrice = rawOpen;
        } else if (rawDailyPct != null && latestPrice != null) {
          // Calculate open price from percentage: open = current / (1 + pct/100)
          todayOpenPrice = latestPrice / (1 + rawDailyPct / 100);
        }

        // Calculate price delta if we have open price
        if (todayOpenPrice != null && latestPrice != null) {
          priceDelta = latestPrice - todayOpenPrice;
        }

        // Use API daily fields if available, otherwise use raw data, otherwise calculate
        let stats = {
          high: apiDailyHigh ?? rawHigh,
          low: apiDailyLow ?? rawLow,
          volume: apiDailyVolume ?? rawVolume,
          value: apiDailyValue ?? rawValue,
          open: apiDailyOpen ?? todayOpenPrice,
          pctChange: rawDailyPct != null ? rawDailyPct : (displayCoin?.daily_change_1d != null ? displayCoin.daily_change_1d : displayCoin?.price_change_percentage_24h || null),
          priceDelta: priceDelta,
          close: latestPrice
        };

        // Fallback: if raw data is missing, calculate from ALL 24h snapshots (not just latest)
        if ((stats.high == null || stats.low == null || stats.volume == null) || !stats.value) {
          const tsList = await storage.getAllTimestamps();
          if (tsList && tsList.length > 0) {
            const latestTs = tsList[tsList.length - 1];
            // Calculate 24 hours ago (24 * 60 * 60 * 1000 milliseconds)
            const twentyFourHoursAgo = latestTs - (24 * 60 * 60 * 1000);

            // Get ALL snapshots from the last 24 hours
            const snapshots24h = await storage.getRange(coin.symbol, twentyFourHoursAgo, latestTs);

            if (snapshots24h && snapshots24h.length > 0) {
              // Sort snapshots by timestamp to get first one (today's open)
              snapshots24h.sort((a, b) => a.ts - b.ts);

              // Calculate today's open price from first snapshot if not already set
              if (stats.open == null && snapshots24h.length > 0) {
                const firstSnapshot = snapshots24h[0];
                const openPrice = firstSnapshot.open || firstSnapshot.price || firstSnapshot.close;
                if (openPrice != null && Number.isFinite(Number(openPrice))) {
                  stats.open = Number(openPrice);
                  // Recalculate price delta if we now have open price
                  if (latestPrice != null) {
                    stats.priceDelta = latestPrice - stats.open;
                  }
                }
              }

              // Calculate high from all 24h snapshots
              if (stats.high == null) {
                const prices = snapshots24h
                  .map(s => s.price || s.high || s.close)
                  .filter(p => p != null && Number.isFinite(Number(p)));
                if (prices.length > 0) {
                  stats.high = Math.max(...prices);
                }
              }

              // Calculate low from all 24h snapshots
              if (stats.low == null) {
                const prices = snapshots24h
                  .map(s => s.price || s.low || s.close)
                  .filter(p => p != null && Number.isFinite(Number(p)));
                if (prices.length > 0) {
                  stats.low = Math.min(...prices);
                }
              }

              // Calculate total volume from all 24h snapshots
              if (stats.volume == null) {
                const volumes = snapshots24h
                  .map(s => s.volume)
                  .filter(v => v != null && Number.isFinite(Number(v)));
                if (volumes.length > 0) {
                  stats.volume = volumes.reduce((sum, v) => sum + Number(v), 0);
                }
              }

              // Calculate total value (turnover) from all 24h snapshots
              // Value = sum of (price * volume) for each snapshot
              if (!stats.value) {
                let totalValue = 0;
                snapshots24h.forEach(s => {
                  const price = s.price || s.close;
                  const volume = s.volume;
                  if (price != null && volume != null && Number.isFinite(Number(price)) && Number.isFinite(Number(volume))) {
                    totalValue += Number(price) * Number(volume);
                  }
                });
                if (totalValue > 0) {
                  stats.value = totalValue;
                } else if (stats.volume && latestPrice) {
                  // Fallback: use latest price * total volume
                  stats.value = stats.volume * latestPrice;
                }
              }
            } else {
              // If no 24h snapshots found, fallback to latest snapshot only
              const latestSnap = await storage.getSnapshotAtOrBefore(coin.symbol, latestTs);
              if (latestSnap) {
                if (stats.high == null) stats.high = latestSnap.high || latestSnap.price;
                if (stats.low == null) stats.low = latestSnap.low || latestSnap.price;
                if (stats.volume == null) stats.volume = latestSnap.volume || coin.volume;
                if (!stats.value && stats.volume && latestPrice) {
                  stats.value = stats.volume * latestPrice;
                }
              }
            }
          }
        }

        if (mounted) {
          setDaily24hStats(stats);
        }
      } catch (err) {
        console.error('CoinModal: load24hStats error', err);
        if (mounted) setDaily24hStats(null);
      }
    }

    load24hStats();

    // Refresh 24h stats periodically when modal is open (every 30 seconds)
    const interval = setInterval(load24hStats, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [coin?.symbol, coin?.raw, coin?.dailyHigh, coin?.dailyLow, coin?.dailyVolume, coin?.dailyValue, coin?.dailyOpen, displayCoin?.price, displayCoin?.raw, displayCoin?.volume, displayCoin?.daily_change_1d, displayCoin?.price_change_percentage_24h, displayCoin?.dailyHigh, displayCoin?.dailyLow, displayCoin?.dailyVolume, displayCoin?.dailyValue, displayCoin?.dailyOpen]);

  // Refresh latest coin data periodically when modal is open
  useEffect(() => {
    let mounted = true;
    async function refreshCoinData() {
      if (!coin || !coin.symbol) return;

      try {
        const tsList = await storage.getAllTimestamps();
        if (!tsList || tsList.length === 0) return;

        const latestTs = tsList[tsList.length - 1];
        const latestSnap = await storage.getSnapshotAtOrBefore(coin.symbol, latestTs);

        if (mounted && latestSnap) {
          // Update current coin with latest data
          setCurrentCoin({
            ...coin,
            price: latestSnap.price || latestSnap.close || coin.price,
            volume: latestSnap.volume || coin.volume,
            ts: latestSnap.ts || coin.ts,
            raw: latestSnap.raw || coin.raw
          });
        }
      } catch (err) {
        // Ignore errors
      }
    }

    refreshCoinData();

    // Refresh every 10 seconds when modal is open
    const interval = setInterval(refreshCoinData, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [coin]);

  // Get percentage from raw data first (most accurate), then from daily24hStats, then from coin
  const raw = displayCoin?.raw || coin?.raw || {};
  const rawDailyPct = raw['Price Change % 1 day'] != null ? Number(raw['Price Change % 1 day']) :
    raw['Price Change % 1 Day'] != null ? Number(raw['Price Change % 1 Day']) :
      raw['Price Change %'] != null ? Number(raw['Price Change %']) :
        raw['daily_pct'] != null ? Number(raw['daily_pct']) : null;

  const pct = rawDailyPct != null
    ? rawDailyPct
    : (daily24hStats?.pctChange != null
      ? daily24hStats.pctChange
      : (displayCoin.daily_change_1d != null
        ? displayCoin.daily_change_1d
        : (displayCoin.price_change_percentage_24h || 0)));
  const pctColor = pct >= 0 ? '#24c55e' : '#ff4d4d';

  // pctToColor function to match bubble colors (same as in App.jsx)
  function pctToColorRgb(pct) {
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const v = clamp(pct, -100, 100);
    if (v === 0) return { r: 255, g: 255, b: 255 };
    if (v > 0) {
      const t = clamp(v / 10, 0, 1);
      return {
        r: Math.round(46 - 20 * t),
        g: Math.round(200 + 40 * t),
        b: Math.round(80 - 30 * t)
      };
    }
    const t = clamp(Math.abs(v) / 10, 0, 1);
    return {
      r: Math.round(220 + 20 * t),
      g: Math.round(100 - 50 * t),
      b: Math.round(100 - 30 * t)
    };
  }

  // Get bubble color RGB for this coin
  const bubbleColorRgb = pctToColorRgb(pct);

  // Create colorful background with bubble color tint for top-box
  const topBoxStyle = {
    background: pct >= 0
      ? `linear-gradient(180deg, rgba(${bubbleColorRgb.r}, ${bubbleColorRgb.g}, ${bubbleColorRgb.b}, 0.18), rgba(${bubbleColorRgb.r}, ${bubbleColorRgb.g}, ${bubbleColorRgb.b}, 0.06))`
      : `linear-gradient(180deg, rgba(${bubbleColorRgb.r}, ${bubbleColorRgb.g}, ${bubbleColorRgb.b}, 0.15), rgba(${bubbleColorRgb.r}, ${bubbleColorRgb.g}, ${bubbleColorRgb.b}, 0.04))`,
    borderColor: `rgba(${bubbleColorRgb.r}, ${bubbleColorRgb.g}, ${bubbleColorRgb.b}, 0.3)`,
    boxShadow: `0 8px 24px rgba(${bubbleColorRgb.r}, ${bubbleColorRgb.g}, ${bubbleColorRgb.b}, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)`
  };

  // ALL STATS BELOW ARE FOR TODAY (ENTIRE DAY) ONLY - NOT AFFECTED BY TIMEFRAME SELECTION
  // Use daily24hStats for all today's calculations, prefer raw data values
  const displayPrice = displayCoin?.price || daily24hStats?.close || coin?.price || '-';

  // Price delta - ONLY use daily24hStats (today's data), NEVER use ohlcSummary (timeframe-dependent)
  const displayPriceDelta = daily24hStats?.priceDelta != null
    ? daily24hStats.priceDelta
    : (() => {
      // Try to calculate from today's open price if available
      if (daily24hStats?.open != null && displayPrice != null && typeof displayPrice === 'number') {
        return displayPrice - daily24hStats.open;
      }
      // Try to calculate from percentage if we have it
      const pct = daily24hStats?.pctChange != null ? daily24hStats.pctChange : (displayCoin?.daily_change_1d != null ? displayCoin.daily_change_1d : displayCoin?.price_change_percentage_24h);
      if (pct != null && displayPrice != null && typeof displayPrice === 'number') {
        const openPrice = displayPrice / (1 + pct / 100);
        return displayPrice - openPrice;
      }
      // Fallback to price_change if available (should be today's change)
      if (displayCoin?.price_change != null && !Number.isNaN(Number(displayCoin.price_change))) {
        return Number(displayCoin.price_change);
      }
      return null;
    })();

  // Today's High/Low - ONLY use daily24hStats (today's data), NEVER fallback to ohlcSummary (which is timeframe-dependent)
  const display24hHigh = daily24hStats?.high != null ? daily24hStats.high : '-';
  const display24hLow = daily24hStats?.low != null ? daily24hStats.low : '-';

  // Today's Volume - prefer raw data which is already today's volume, don't sum snapshots
  const display24hVolume = daily24hStats?.volume != null
    ? daily24hStats.volume
    : (displayCoin?.volume != null
      ? displayCoin.volume
      : (latestSnapshot?.volume != null
        ? latestSnapshot.volume
        : coin?.volume || null));

  // Today's Value - prefer raw turnover value, fallback to volume * price
  const display24hValue = daily24hStats?.value != null
    ? daily24hStats.value
    : (display24hVolume != null && displayPrice != null && typeof displayPrice === 'number'
      ? display24hVolume * displayPrice
      : null);

  // Share calculator state: two boxes (shares <=> PKR) — animated target display
  const [shareCount, setShareCount] = useState('');
  const [pkrInput, setPkrInput] = useState('');
  const [shareFocused, setShareFocused] = useState(false);
  const [pkrFocused, setPkrFocused] = useState(false);

  // Animated display values (visual tweening) — animate the converted results for UX
  const [displayedTotal, setDisplayedTotal] = useState(0);
  const displayedRef = useRef(0);
  const rafRef = useRef(null);
  const [displayedShares, setDisplayedShares] = useState(0);
  const displayedSharesRef = useRef(0);
  const rafRefShares = useRef(null);

  const priceNum = (() => {
    const p = displayPrice != null && typeof displayPrice === 'number'
      ? Number(displayPrice)
      : (ohlcSummary && ohlcSummary.close != null ? Number(ohlcSummary.close) : 0);
    return Number.isFinite(p) ? p : 0;
  })();

  // Simple derived helpers (used only for sync when typing)
  const computePkrFromShares = (s) => {
    if (!Number.isFinite(s) || priceNum === 0) return '';
    // show two decimals for currency
    return (s * priceNum).toFixed(2).replace(/\.00$/, '');
  };
  const computeSharesFromPkr = (pkr) => {
    if (!Number.isFinite(pkr) || priceNum === 0) return '';
    // show up to 4 decimals for shares
    return (pkr / priceNum).toFixed(4).replace(/\.0000$/, '');
  };

  const targetTotal = (() => {
    const s = Number(String(shareCount).replace(/[^0-9.-]+/g, ''));
    if (!Number.isFinite(s) || s === 0) return 0;
    return s * priceNum;
  })();

  const targetSharesFromPkr = (() => {
    const pkr = Number(String(pkrInput).replace(/[^0-9.-]+/g, ''));
    if (!Number.isFinite(pkr) || pkr === 0 || priceNum === 0) return 0;
    return pkr / priceNum;
  })();

  // animate displayedTotal -> targetTotal
  useEffect(() => {
    const duration = 350; // ms
    const start = displayedRef.current || 0;
    const end = targetTotal || 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const startTime = performance.now();
    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      // easeOutQuad
      const eased = 1 - (1 - t) * (1 - t);
      const cur = start + (end - start) * eased;
      displayedRef.current = cur;
      setDisplayedTotal(cur);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [targetTotal]);

  // animate displayedShares -> targetSharesFromPkr
  useEffect(() => {
    const duration = 350; // ms
    const start = displayedSharesRef.current || 0;
    const end = targetSharesFromPkr || 0;
    if (rafRefShares.current) cancelAnimationFrame(rafRefShares.current);
    const startTime = performance.now();
    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      const cur = start + (end - start) * eased;
      displayedSharesRef.current = cur;
      setDisplayedShares(cur);
      if (t < 1) rafRefShares.current = requestAnimationFrame(step);
    }
    rafRefShares.current = requestAnimationFrame(step);
    return () => { if (rafRefShares.current) cancelAnimationFrame(rafRefShares.current); };
  }, [targetSharesFromPkr]);

  // Initialize defaults: 1 share and its PKR value when coin/price changes
  useEffect(() => {
    const initShares = 1;
    const initPkr = computePkrFromShares(initShares);
    setShareCount(String(initShares));
    setPkrInput(String(initPkr));
    // set displayed values directly (no animation on mount)
    displayedRef.current = Number(initPkr) || 0;
    setDisplayedTotal(Number(initPkr) || 0);
    displayedSharesRef.current = initShares;
    setDisplayedShares(initShares);
  }, [coin?.symbol, priceNum]);

  return (
    <div className="overlay">
      <div className="backdrop" onClick={onClose} />
      <div className="coin-modal" role="dialog" aria-modal="true">
        {/* improved header: symbol-first layout with price / pct and compact stats row */}

        <div className="top-box" style={topBoxStyle}>
          <div className="coin-top header-v2">
            <div className="symbol-row">
              {coin.image && <img src={coin.image} alt="" className="coin-image" />}
              <div className="symbol-info">
                <div className="symbol-line">
                  <div className="symbol-code">{coin.symbol?.toUpperCase() || ''}</div>
                  <div className="symbol-badge">{coin.market || 'REG'}</div>
                </div>
                <div className="price-line">
                  <div className="coin-price">
                    {typeof displayPrice === 'number'
                      ? Number(displayPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                      : displayPrice}
                  </div>
                  <div className="pct-badge" style={{ background: pct >= 0 ? 'rgba(36,197,94,0.14)' : 'rgba(255,77,77,0.08)', color: pct >= 0 ? '#24c55e' : '#ff4d4d' }}>
                    {pct >= 0 ? '+' : ''}{typeof pct === 'number' ? pct.toFixed(2) : pct}%
                  </div>
                  <div className="small-change" style={{ color: (displayPriceDelta != null && displayPriceDelta >= 0) ? '#24c55e' : '#ff4d4d' }}>
                    {displayPriceDelta != null ? (displayPriceDelta >= 0 ? '+' : '') + Number(displayPriceDelta).toFixed(2) : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Today's stats using daily24hStats - always shows entire day data, regardless of timeframe selection */}
            <div className="top-stats">
              <div className="stat-col">
                <div className="stat-label">Today High</div>
                <div className="stat-value">
                  {typeof display24hHigh === 'number'
                    ? Number(display24hHigh).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                    : display24hHigh}
                </div>
              </div>
              <div className="stat-col">
                <div className="stat-label">Today Low</div>
                <div className="stat-value">
                  {typeof display24hLow === 'number'
                    ? Number(display24hLow).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                    : display24hLow}
                </div>
              </div>
              <div className="stat-col">
                <div className="stat-label">Today Vol</div>
                <div className="stat-value">
                  {display24hVolume != null && typeof display24hVolume === 'number'
                    ? formatLargeNumber(display24hVolume)
                    : (display24hVolume || '-')}
                </div>
              </div>
              <div className="stat-col">
                <div className="stat-label">Today Value</div>
                <div className="stat-value">
                  {display24hValue != null && typeof display24hValue === 'number'
                    ? formatLargeNumber(display24hValue)
                    : (display24hValue || '-')}
                </div>
              </div>
            </div>
          </div>

          <div className="coin-stats-row">
            <div className="coin-stats-left" />
            <div className="coin-stats-right">
              <div className="stat">Market Cap<br /><strong>{coin.market_cap?.toLocaleString?.() ?? '-'}</strong></div>
            </div>
          </div>

          {/* Share calculator: exactly two boxes with '=' between them. Editing either box updates the other immediately. */}
          <div className="share-calc">
            <label className="share-label">Converter</label>
            <div className="share-input-row">
              <div className="share-input-wrap">
                <span className="share-icon">✎</span>
                <input
                  className="share-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="Shares"
                  value={shareFocused ? shareCount : (displayedShares ? Number(displayedShares).toFixed(4).replace(/\.0000$/, '') : shareCount)}
                  onFocus={() => setShareFocused(true)}
                  onBlur={() => {
                    setShareFocused(false);
                    // when leaving focus, update the raw share string to the current displayed value
                    setShareCount(displayedShares ? Number(displayedShares).toFixed(4).replace(/\.0000$/, '') : '');
                  }}
                  onChange={(e) => {
                    const v = e.target.value;
                    setShareCount(v);
                    // update target total to animate the PKR display
                    const s = Number(String(v).replace(/[^0-9.-]+/g, ''));
                    if (Number.isFinite(s)) {
                      // set pkrInput only when pkr field is focused (so typing there isn't clobbered)
                      if (pkrFocused) {
                        setPkrInput(computePkrFromShares(s));
                      }
                      // animation will run because targetTotal derived from shareCount changed
                    }
                  }}
                />
              </div>

              <div className="calc-result">
                <span className="calc-eq">=</span>
              </div>

              <div className="share-input-wrap pkr-wrap">
                <span className="share-icon">₨</span>
                <input
                  className="share-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="PKR"
                  value={pkrFocused ? pkrInput : (displayedTotal ? Number(displayedTotal).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : pkrInput)}
                  onFocus={() => setPkrFocused(true)}
                  onBlur={() => {
                    setPkrFocused(false);
                    // sync raw pkrInput to displayed value when leaving focus
                    setPkrInput(displayedTotal ? Number(displayedTotal).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '');
                  }}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPkrInput(v);
                    const pkr = Number(String(v).replace(/[^0-9.-]+/g, ''));
                    if (Number.isFinite(pkr) && priceNum > 0) {
                      if (shareFocused) {
                        setShareCount(computeSharesFromPkr(pkr));
                      }
                      // animation will run because targetSharesFromPkr derived from pkrInput changed
                    }
                  }}
                />
              </div>
            </div>
          </div>
          {/* Area chart only — removed area/line/candles toggle */}
        </div>
        <div className="chart-area">
          <div className="chart-header">
            {/* chart header left intentionally minimal (Open/Low/High removed per request) */}
          </div>

          <div className="sparkline">

            <InteractiveChart series={series} pct={pct} height={320} />
          </div>

          <div className="timeframe-row">
            {['Hour', 'Day', 'Week', 'Month', 'Year'].map((tf) => (
              <div key={tf} className={`time-pill ${timeframe === tf ? 'active' : ''}`} onClick={() => setTimeframe(tf)}>
                {tf}
                <br />
                <span className="pill-pct">{pillPctMap && pillPctMap[tf] != null ? pillPctMap[tf] : '-'}</span>
              </div>
            ))}
          </div>
        </div>


        {/* close button removed per request (backdrop click and Escape still close the modal) */}
      </div>
    </div>
  );
}

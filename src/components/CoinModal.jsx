import React, { useEffect, useState, useRef } from 'react';
import storage from '../lib/storage';
import { ENABLE_REPO_SNAPSHOTS, ENABLE_LIVE_API, LIVE_API_BASE_URL, LIVE_API_KEY } from '../config';
import EmbeddedChart from './EmbeddedChart';
import { IndicatorButton } from './indicators';
import { buildCandlesFromSnapshots } from '../lib/chartUtils';
import { getCandleType, setCandleType } from '../lib/indicators';

// Icon/trade buttons removed for stock-focused UI

// Lazy load the fullscreen chart component
const AdvancedChart = React.lazy(() => import('./AdvancedChart'));

export default function CoinModal({ coin, onClose, bubbleInterval }) {
  // Map bubble interval names to chart interval names
  const mapBubbleToChartInterval = (bubbleInt) => {
    const mapping = {
      '1 Min': '1m',
      '5 Min': '5m',
      '15 Min': '15m',
      'Hour': '1h',
      'Day': 'Day',
      'Week': 'Week',
      'Month': 'Month',
      'Year': 'Year',
      // Tick intervals - use actual tick format
      '10 Ticks': '10 Ticks',
      '100 Ticks': '100 Ticks',
      '500 Ticks': '500 Ticks',
      '1000 Ticks': '1000 Ticks'
    };
    return mapping[bubbleInt] || '15m';
  };

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!coin) return null;

  const [timeframe, setTimeframe] = useState('Day');
  const [candleInterval, setCandleInterval] = useState(() => mapBubbleToChartInterval(bubbleInterval)); // Use bubble interval as default
  const [showAdvancedChart, setShowAdvancedChart] = useState(false);
  const [series, setSeries] = useState([]);
  const [ohlcSummary, setOhlcSummary] = useState(null);
  const [pillPctMap, setPillPctMap] = useState({});
  const [latestSnapshot, setLatestSnapshot] = useState(null);
  const [daily24hStats, setDaily24hStats] = useState(null);
  const [currentCoin, setCurrentCoin] = useState(coin);
  const [chartType, setChartType] = useState('Candles'); // 'Candles' or 'Area'
  const [candleType, setCandleTypeState] = useState(() => getCandleType()); // 'Candles' or 'Heikin-Ashi'

  // Advanced chart can have different symbol than modal
  const [advancedChartSymbol, setAdvancedChartSymbol] = useState(coin?.symbol);

  // Persist candleType changes
  const handleCandleTypeChange = (type) => {
    setCandleTypeState(type);
    setCandleType(type);
  };

  // Indicators state for external control
  const embeddedChartRef = useRef(null);
  const [indicatorCount, setIndicatorCount] = useState(0);
  const CANDLE_INTERVALS = ['1m', '5m', '15m', '1h', '4h', 'Day', 'Week', 'Month', 'Year'];
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
      console.log('[CoinModal] loadSeries called for', coin.symbol, 'timeframe:', timeframe, 'candleInterval:', candleInterval);
      try {
        const isCandleMode = chartType === 'Candles';
        // Effective timeframe for data fetching logic
        const effectiveTf = isCandleMode ? candleInterval : timeframe;
        const isTick = effectiveTf.includes('Tick');

        if (isTick) {
          // Tick-based fetching (Bypasses storage, goes straight to API)
          try {
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            const base = LIVE_API_BASE_URL.startsWith('http') ? LIVE_API_BASE_URL : `${origin}${LIVE_API_BASE_URL.startsWith('/') ? '' : '/'}${LIVE_API_BASE_URL}`;
            const url = new URL('tick-candles', base.endsWith('/') ? base : `${base}/`);

            // Convert "100 Ticks" -> "100T"
            const intervalCode = effectiveTf.replace(' Ticks', 'T').replace(' ', '');
            url.searchParams.set('symbol', coin.symbol);
            url.searchParams.set('interval', intervalCode);
            url.searchParams.set('limit', '100'); // Reasonable limit for tick charts

            const headers = { 'Content-Type': 'application/json' };
            if (LIVE_API_KEY) headers['x-api-key'] = LIVE_API_KEY;

            const res = await fetch(url.toString(), { headers });
            if (!res.ok) throw new Error('Tick API failed');
            const json = await res.json();

            if (mounted && json.data) {
              const s = json.data.map(d => ({
                ts: new Date(d.ts).getTime(),
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                volume: d.volume
              }));
              // Ticks come oldest->newest from backend?
              // tick-candles.mjs reverses them at the end: "candles.reverse()"
              // So they are oldest -> newest. Correct for charts.

              setSeries(s);

              if (s.length > 0) {
                const open = s[0].open;
                const close = s[s.length - 1].close;
                const low = Math.min(...s.map(i => i.low));
                const high = Math.max(...s.map(i => i.high));
                setOhlcSummary({ open, low, high, close });

                // We don't support pillPctMap for ticks easily yet (would need many queries)
                setPillPctMap({});
              }
            }
          } catch (err) {
            console.error('Tick fetch error', err);
            if (mounted) setSeries([]);
          }
          return;
        }

        // --- Time-Based Logic: Use Live API as primary source ---
        // Fetch candles from live API first (has proper historical data)
        let rows = [];
        try {
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const base = LIVE_API_BASE_URL.startsWith('http') ? LIVE_API_BASE_URL : `${origin}${LIVE_API_BASE_URL.startsWith('/') ? '' : '/'}${LIVE_API_BASE_URL}`;
          const url = new URL('candles', base.endsWith('/') ? base : `${base}/`);
          url.searchParams.set('symbol', coin.symbol);

          // Map timeframe to API interval
          let apiInterval = '1h';
          if (isCandleMode) {
            apiInterval = effectiveTf; // e.g. 1m, 15m, 1h, 4h, Day, Week, Month, Year
          } else {
            // Legacy Area mapping
            const intervalMap = {
              'Hour': '1h',
              'Day': 'Day',
              'Week': 'Day',
              'Month': 'Day',
              'Year': 'Day'
            };
            apiInterval = intervalMap[timeframe] || '1h';
          }

          url.searchParams.set('interval', apiInterval);
          url.searchParams.set('limit', '500');

          console.log('[CoinModal] Fetching candles from:', url.toString());
          const headers = { 'Content-Type': 'application/json' };
          if (LIVE_API_KEY) headers['x-api-key'] = LIVE_API_KEY;

          const res = await fetch(url.toString(), { headers });
          if (res.ok) {
            const json = await res.json();
            if (json.data && json.data.length > 0) {
              rows = json.data.map(d => ({
                ts: new Date(d.ts).getTime(),
                open: Number(d.open),
                high: Number(d.high),
                low: Number(d.low),
                close: Number(d.close),
                volume: Number(d.volume) || 0
              })).filter(d => d.close > 0);
              rows.sort((a, b) => a.ts - b.ts);
            }
          }
        } catch (e) {
          console.warn('CoinModal: Failed to fetch live candles', e);
        }

        // If API failed, fall back to storage
        if (rows.length === 0) {
          console.log('[CoinModal] API returned no data, falling back to storage');
          const tsList = await storage.getAllTimestamps();
          if (tsList && tsList.length > 0) {
            const latestTs = tsList[tsList.length - 1];
            const latestIdx = tsList.length - 1;
            const lookback = INTERVAL_LOOKUP[timeframe] || 1;
            const targetIdx = Math.max(0, latestIdx - lookback);
            const earlierTs = tsList[targetIdx];
            rows = await storage.getRange(coin.symbol, earlierTs, latestTs);
          }
        }

        // If data already has OHLC (from API), use directly; otherwise build from snapshots
        let s = [];
        if (rows.length > 0 && rows[0].open !== undefined) {
          // Data already has OHLC
          s = rows.map(r => ({ ts: r.ts, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume }));
        } else if (rows.length > 0) {
          // Build candles from price snapshots
          const BUCKET_MS = {
            Hour: 5 * 60 * 1000,
            Day: 60 * 60 * 1000,
            Week: 6 * 60 * 60 * 1000,
            Month: 24 * 60 * 60 * 1000,
            Year: 7 * 24 * 60 * 60 * 1000
          };
          const bucketMs = BUCKET_MS[timeframe] || 60 * 60 * 1000;
          let candles = buildCandlesFromSnapshots(rows.map(r => ({ ts: r.ts, price: r.price, volume: r.volume })), bucketMs);
          s = candles.map((c) => ({ ts: Number(c.time) * 1000, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })).filter((x) => x.close != null);
        }

        if (mounted) {
          setSeries(s);
          if (s && s.length) {
            const open = s[0].open != null ? s[0].open : s[0].close;
            const close = s[s.length - 1].close;
            const low = Math.min(...s.map((z) => (z.low != null ? z.low : z.close)));
            const high = Math.max(...s.map((z) => (z.high != null ? z.high : z.close)));
            setOhlcSummary({ open, low, high, close });

            // Compute percentage from first to last candle in current series
            const pctMap = {};
            if (s.length >= 2) {
              const pct = ((close - open) / open) * 100;
              // For candle mode, we don't have a pill map for the new intervals yet, 
              // or we can just store it in state if needed, but the pills are hidden in candle mode.
              if (!isCandleMode) {
                pctMap[timeframe] = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
              }
            }
            if (!isCandleMode) setPillPctMap(pctMap);

            // FORCE SYNC: If we have a live coin price that is newer/different than the API tail,
            // update the last candle to match the header immediately.
            if (s.length > 0 && coin && coin.price) {
              const lastCandle = s[s.length - 1];
              const headerPrice = Number(coin.price);
              if (Number.isFinite(headerPrice)) {

                // Only update if substantially different or just to be safe
                lastCandle.close = headerPrice;

                // Adjust high/low if the current price is outside current bounds
                if (headerPrice > lastCandle.high) lastCandle.high = headerPrice;
                if (headerPrice < lastCandle.low) lastCandle.low = headerPrice;

                // Update OHLC summary as well
                setOhlcSummary(prev => ({
                  open: s[0].open,
                  low: Math.min(...s.map(z => z.low)),
                  high: Math.max(...s.map(z => z.high)),
                  close: headerPrice
                }));
              }
            }

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

    // Initial Load
    loadSeries();

    // Auto-Refresh Poll (every 10 seconds)
    let intervalId = null;
    if (ENABLE_LIVE_API) {
      intervalId = setInterval(() => {
        // We can just call loadSeries again. 
        // Ideally we shouldn't show loading state on poll, but loadSeries doesn't toggle a 'loading' state prop other than internal vars.
        loadSeries();
      }, 10000);
    }

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [coin, timeframe, candleInterval, chartType]);

  // Update currentCoin when coin prop changes (real-time updates)
  useEffect(() => {
    setCurrentCoin(coin);
  }, [coin]);

  // REAL-TIME CHART UPDATE
  // When currentCoin updates (price changes), update the LATEST candle in the series
  useEffect(() => {
    if (series && series.length > 0 && currentCoin && currentCoin.price) {
      const price = Number(currentCoin.price);
      if (!Number.isFinite(price)) return;

      setSeries(prevSeries => {
        if (!prevSeries || prevSeries.length === 0) return prevSeries;

        // Clone the series to avoid mutation issues
        const newSeries = [...prevSeries];
        const lastIdx = newSeries.length - 1;
        const lastCandle = { ...newSeries[lastIdx] };

        // Update close
        lastCandle.close = price;

        // Update High/Low
        if (price > lastCandle.high) lastCandle.high = price;
        if (price < lastCandle.low) lastCandle.low = price;

        // Do not change Open or TS

        newSeries[lastIdx] = lastCandle;
        return newSeries;
      });

      // Also update OHLC summary so stats valid
      setOhlcSummary(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          close: price,
          high: Math.max(prev.high, price),
          low: Math.min(prev.low, price)
        };
      });
    }
  }, [currentCoin]);

  // Define displayCoin BEFORE it's used in useEffect
  const displayCoin = currentCoin || coin;

  // Calculate 24h stats - prefer API-provided daily fields (most accurate)
  useEffect(() => {
    let mounted = true;
    async function load24hStats() {
      if (!coin || !coin.symbol) return;

      try {
        const raw = displayCoin?.raw || coin?.raw || {};

        // PRIORITY 0: LIVE API (if enabled)
        // If live API is enabled, fetch true 24h stats directly from the server
        if (ENABLE_LIVE_API) {
          try {
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            const base = LIVE_API_BASE_URL.startsWith('http')
              ? LIVE_API_BASE_URL
              : `${origin}${LIVE_API_BASE_URL.startsWith('/') ? '' : '/'}${LIVE_API_BASE_URL}`;
            const url = new URL('bubbles', base.endsWith('/') ? base : `${base}/`);
            url.searchParams.set('interval', 'Day');
            url.searchParams.set('favorites', coin.symbol);
            url.searchParams.set('_t', Date.now().toString());

            const headers = { 'Content-Type': 'application/json' };
            if (LIVE_API_KEY) headers['x-api-key'] = LIVE_API_KEY;

            const res = await fetch(url.toString(), { headers });
            if (res.ok) {
              const json = await res.json();
              const dayList = json.data || json.symbols || [];
              if (dayList.length > 0) {
                const dayData = dayList.find(d => d.symbol === coin.symbol) || dayList[0];
                if (dayData) {
                  // Found daily data, use it for stats
                  const stats = {
                    high: dayData.high,
                    low: dayData.low,
                    volume: dayData.day_volume ?? dayData.volume,
                    value: dayData.value,
                    open: dayData.open,
                    pctChange: dayData.pct_24h || dayData.percentage || dayData.daily_change_1d,
                    // priceDelta: intentionally omitted to allow dynamic calculation (price - open) for real-time accuracy
                    close: dayData.close
                  };
                  if (mounted) setDaily24hStats(stats);
                  return; // Exit early, we have authoritative data
                }
              }
            }
          } catch (e) {
            console.warn('Failed to fetch daily stats from API, falling back to local data', e);
          }
        }

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

        // Fix "Zero Value" Issue: If value is 0 but we have volume & price, calculate it.
        if (!stats.value && stats.volume && (stats.close || latestPrice)) {
          stats.value = stats.volume * (stats.close || latestPrice);
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
    const interval = setInterval(load24hStats, 3000);

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
    const interval = setInterval(refreshCoinData, 2000);

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

  // Calculate % change from ohlcSummary (chart data) as fallback
  const ohlcPctChange = (ohlcSummary?.open && ohlcSummary?.close && ohlcSummary.open !== 0)
    ? ((ohlcSummary.close - ohlcSummary.open) / ohlcSummary.open) * 100
    : null;

  const pct = rawDailyPct != null && rawDailyPct !== 0
    ? rawDailyPct
    : (daily24hStats?.pctChange != null && daily24hStats.pctChange !== 0
      ? daily24hStats.pctChange
      : (ohlcPctChange != null
        ? ohlcPctChange
        : (displayCoin.daily_change_1d != null
          ? displayCoin.daily_change_1d
          : (displayCoin.price_change_percentage_24h || 0))));
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
  // PRIORITY: Use fresh API data (daily24hStats) first, then fallback to displayCoin/coin
  const displayPrice = daily24hStats?.close ?? displayCoin?.price ?? coin?.price ?? '-';

  // Price delta - ONLY use daily24hStats (today's data), NEVER use ohlcSummary (timeframe-dependent)
  const displayPriceDelta = daily24hStats?.priceDelta != null
    ? daily24hStats.priceDelta
    : (() => {
      // Try to calculate from today's open price if available
      if (daily24hStats?.open != null && displayPrice != null && typeof displayPrice === 'number') {
        const delta = displayPrice - daily24hStats.open;
        if (delta !== 0) return delta;
      }
      // Try to calculate from percentage if we have it
      const pctVal = daily24hStats?.pctChange != null ? daily24hStats.pctChange : (displayCoin?.daily_change_1d != null ? displayCoin.daily_change_1d : displayCoin?.price_change_percentage_24h);
      if (pctVal != null && pctVal !== 0 && displayPrice != null && typeof displayPrice === 'number') {
        const openPrice = displayPrice / (1 + pctVal / 100);
        return displayPrice - openPrice;
      }
      // Fallback to ohlcSummary (chart data) when API is stale
      if (ohlcSummary?.open != null && ohlcSummary?.close != null) {
        const delta = ohlcSummary.close - ohlcSummary.open;
        if (delta !== 0) return delta;
      }
      // Fallback to price_change if available
      if (displayCoin?.price_change != null && !Number.isNaN(Number(displayCoin.price_change))) {
        return Number(displayCoin.price_change);
      }
      return null;
    })();

  // Detect stale data: if high = low = close, it means no real trading data for today (weekend/holiday)
  const isStaleHighLow = daily24hStats?.high === daily24hStats?.close && daily24hStats?.low === daily24hStats?.close;

  // Today's High/Low - prefer daily24hStats, fallback to ohlcSummary (chart data) if stale
  const display24hHigh = (!isStaleHighLow && daily24hStats?.high != null)
    ? daily24hStats.high
    : (ohlcSummary?.high ?? daily24hStats?.high ?? '-');
  const display24hLow = (!isStaleHighLow && daily24hStats?.low != null)
    ? daily24hStats.low
    : (ohlcSummary?.low ?? daily24hStats?.low ?? '-');

  // Today's Volume - prefer raw data which is already today's volume, don't sum snapshots
  const display24hVolume = daily24hStats?.volume != null
    ? daily24hStats.volume
    : (displayCoin?.volume != null
      ? displayCoin.volume
      : (latestSnapshot?.volume != null
        ? latestSnapshot.volume
        : coin?.volume || null));

  // Today's Value - prefer raw turnover value IF > 0, otherwise calculate from volume * price
  const display24hValue = (daily24hStats?.value != null && daily24hStats.value > 0)
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
        </div>

        <div className="chart-area">
          {/* Header row for Timeframe pills + Chart Type */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 8px' }}>
            {/* Type Toggle - includes candle type option */}
            <div style={{ display: 'flex', background: '#334155', borderRadius: '4px', padding: '2px' }}>
              {['Candles', 'Heikin-Ashi', 'Area'].map(type => {
                // Candles and Heikin-Ashi both use candlestick rendering
                const isActive = type === 'Area'
                  ? chartType === 'Area'
                  : (chartType === 'Candles' && candleType === type);
                return (
                  <button
                    key={type}
                    onClick={() => {
                      if (type === 'Area') {
                        setChartType('Area');
                      } else {
                        setChartType('Candles');
                        handleCandleTypeChange(type);
                      }
                    }}
                    style={{
                      padding: '4px 8px',
                      background: isActive ? '#1e293b' : 'transparent',
                      color: isActive ? '#fff' : '#94a3b8',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>

            {/* Candle Interval & Indicators (Visible only when Type == Candles) */}
            {chartType === 'Candles' && (
              <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Interval Dropdown */}
                <div className="custom-select-wrapper" style={{ display: 'inline-block', position: 'relative' }}>
                  <select
                    value={candleInterval}
                    onChange={(e) => setCandleInterval(e.target.value)}
                    style={{
                      background: '#334155',
                      color: '#e2e8f0',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 24px 4px 8px',
                      fontSize: '13px',
                      appearance: 'none',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    {['10 Ticks', '100 Ticks', '500 Ticks', '1000 Ticks', '1m', '5m', '15m', '1h', '4h', 'Day', 'Week', 'Month', 'Year'].map(int => (
                      <option key={int} value={int}>{int}</option>
                    ))}
                  </select>
                  <span style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: '#94a3b8',
                    fontSize: '10px'
                  }}>▼</span>
                </div>

                {/* Indicators Button */}
                <IndicatorButton
                  onClick={() => embeddedChartRef.current?.openIndicators()}
                  activeCount={indicatorCount}
                />
              </div>
            )}

            {/* Timeframes for Area Chart (Hidden if Candles) */}
            {chartType !== 'Candles' && (
              <div className="timeframe-row" style={{ marginTop: 0 }}>
                {['Hour', 'Day', 'Week', 'Month', 'Year', '100 Ticks', '1000 Ticks'].map((tf) => (
                  <div key={tf} className={`time-pill ${timeframe === tf ? 'active' : ''}`} onClick={() => setTimeframe(tf)}>
                    {tf}
                    <br />
                    <span className="pill-pct">{pillPctMap && pillPctMap[tf] != null ? pillPctMap[tf] : '-'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chart */}
          <EmbeddedChart
            ref={embeddedChartRef}
            data={series}
            symbol={coin.symbol}
            height={320}
            chartType={chartType}
            candleType={candleType}
            onFullscreen={() => {
              const interval = chartType === 'Candles' ? candleInterval : timeframe;
              window.open(`/chart/${coin.symbol}?interval=${encodeURIComponent(interval)}&type=${chartType}&candleType=${candleType}`, '_blank');
            }}
            onActiveCountChange={setIndicatorCount}
          />
        </div>


        {/* close button removed per request (backdrop click and Escape still close the modal) */}

        {/* Advanced Chart Overlay */}
        {showAdvancedChart && (
          <React.Suspense fallback={<div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center text-white">Loading Chart...</div>}>
            <AdvancedChart
              data={series}
              symbol={advancedChartSymbol || coin.symbol}
              timeframe={chartType === 'Candles' ? candleInterval : timeframe}
              onTimeframeChange={chartType === 'Candles' ? setCandleInterval : setTimeframe}
              chartType={chartType}
              setChartType={setChartType}
              candleType={candleType}
              setCandleType={handleCandleTypeChange}
              onClose={() => setShowAdvancedChart(false)}
              onSymbolChange={setAdvancedChartSymbol}
            />
          </React.Suspense>
        )}
      </div>
    </div >
  );
}


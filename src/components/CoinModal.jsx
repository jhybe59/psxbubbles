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
  // only area chart is used now
  const INTERVAL_LOOKUP = { Hour: 1, Day: 1, Week: 5, Month: 22, Year: 252 };

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
          // debug: log series length and first few points to help diagnose empty chart issues
          try {
            // eslint-disable-next-line no-console
            console.debug('CoinModal loadSeries', { symbol: coin?.symbol, seriesLength: s.length, sample: s.slice(0, 5) });
            // also log the candles returned (post-bucketing)
            console.debug('CoinModal mapped series (first 8)', s.slice(0, 8));
          } catch (e) {}
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
            // debug: log which snapshot was chosen as latest for this symbol
            try { console.debug('CoinModal latestSnapshot for', coin?.symbol, latestSnap); } catch (e) {}
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

  const pct = coin.price_change_percentage_24h || 0;
  const pctColor = pct >= 0 ? '#24c55e' : '#ff4d4d';

  // compute a fallback 24h volume from the loaded series if snapshot volume is missing/zero
  const computed24hVol = (series && series.length) ? series.reduce((sum, r) => sum + (r.volume != null ? Number(r.volume) : 0), 0) : null;

  // compute a price delta (absolute) to show rupee change inside the header box
  const computedPriceDelta = (() => {
    // prefer explicit field if present
    if (coin && coin.price_change != null && !Number.isNaN(Number(coin.price_change))) return Number(coin.price_change);
    // prefer series delta (last - first)
    if (series && series.length > 1) {
      const first = series[0].close;
      const last = series[series.length - 1].close;
      if (first != null && last != null) return Number(last) - Number(first);
    }
    // fallback to ohlcSummary open/close
    if (ohlcSummary && ohlcSummary.open != null && ohlcSummary.close != null) return Number(ohlcSummary.close) - Number(ohlcSummary.open);
    // else unknown
    return null;
  })();

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
    const p = coin.price != null ? Number(coin.price) : (ohlcSummary && ohlcSummary.close != null ? Number(ohlcSummary.close) : 0);
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
    <div className="overlay" style={{ zIndex: 2000 }}>
      <div className="backdrop" onClick={onClose} />
      <div className="coin-modal" role="dialog" aria-modal="true">
        {/* improved header: symbol-first layout with price / pct and compact stats row */}

        <div className="top-box">
        <div className="coin-top header-v2">
          <div className="symbol-row">
            {coin.image && <img src={coin.image} alt="" className="coin-image" />}
            <div className="symbol-info">
              <div className="symbol-line">
                <div className="symbol-code">{coin.symbol?.toUpperCase() || ''}</div>
                <div className="symbol-badge">{coin.market || 'REG'}</div>
              </div>
              <div className="price-line">
                <div className="coin-price">{coin.price != null ? Number(coin.price).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:4}) : '-'}</div>
                <div className="pct-badge" style={{ background: pct >= 0 ? 'rgba(36,197,94,0.14)' : 'rgba(255,77,77,0.08)', color: pct >= 0 ? '#24c55e' : '#ff4d4d' }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</div>
                <div className="small-change" style={{ color: (computedPriceDelta != null && computedPriceDelta >= 0) ? '#24c55e' : '#ff4d4d' }}>{computedPriceDelta != null ? (computedPriceDelta >= 0 ? '+' : '') + Number(computedPriceDelta).toFixed(2) : ''}</div>
              </div>
            </div>
          </div>

          {/* compact stats row similar to requested layout (24h High / Low / Vol / Value / Bid / Ask) */}
          <div className="top-stats">
            <div className="stat-col"><div className="stat-label">24h High</div><div className="stat-value">{ohlcSummary && ohlcSummary.high != null ? ohlcSummary.high : '-'}</div></div>
            <div className="stat-col"><div className="stat-label">24h Low</div><div className="stat-value">{ohlcSummary && ohlcSummary.low != null ? ohlcSummary.low : '-'}</div></div>
            {/* Prefer snapshot volume stored from CSV for 24h Vol and 24h Value; fall back to computed series or coin.volume */}
            <div className="stat-col"><div className="stat-label">24h Vol</div><div className="stat-value">{(latestSnapshot && latestSnapshot.volume != null) ? Number(latestSnapshot.volume).toLocaleString() : (computed24hVol != null && computed24hVol !== 0 ? Number(computed24hVol).toLocaleString() : (coin.volume != null ? Number(coin.volume).toLocaleString() : '-'))}</div></div>
            <div className="stat-col"><div className="stat-label">24h Value</div><div className="stat-value">{(latestSnapshot && latestSnapshot.volume != null && coin.price != null) ? (Number(latestSnapshot.volume) * Number(coin.price)).toLocaleString() : ((coin.volume != null && coin.price != null) ? (Number(coin.volume) * Number(coin.price)).toLocaleString() : '-')}</div></div>
          </div>
        </div>

        <div className="coin-stats-row">
          <div className="coin-stats-left" />
          <div className="coin-stats-right">
            <div className="stat">Market Cap<br/><strong>{coin.market_cap?.toLocaleString?.() ?? '-'}</strong></div>
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
                value={pkrFocused ? pkrInput : (displayedTotal ? Number(displayedTotal).toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2}) : pkrInput)}
                onFocus={() => setPkrFocused(true)}
                onBlur={() => {
                  setPkrFocused(false);
                  // sync raw pkrInput to displayed value when leaving focus
                  setPkrInput(displayedTotal ? Number(displayedTotal).toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2}) : '');
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
            <div style={{marginTop:10, color:'#9fb8b0', fontSize:12}}>
              <div>Series points: {Array.isArray(series) ? series.length : 0}</div>
              {Array.isArray(series) && series.length > 0 && (
                    <div style={{marginTop:6, fontSize:11, color:'#cddfe0'}}>
                      <strong>Sample:</strong>
                      <pre style={{margin:6, padding:8, background:'rgba(0,0,0,0.35)', borderRadius:6, overflowX:'auto'}}>{JSON.stringify(series.slice(0,5).map(s=>({t:(function(ts){const n=Number(ts); return Number.isFinite(n)? new Date(n).toISOString() : null})(s.ts), o:s.open, h:s.high, l:s.low, c:s.close, v:s.volume})),null,2)}</pre>
                    </div>
                  )}
            </div>
          </div>

          <div className="timeframe-row">
            {['Hour','Day','Week','Month','Year'].map((tf) => (
              <div key={tf} className={`time-pill ${timeframe===tf? 'active':''}`} onClick={() => setTimeframe(tf)}>
                {tf}
                <br/>
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

import React, { useEffect, useState } from 'react';
import storage from '../lib/storage';

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
        const rows = await storage.getRange(coin.symbol, earlierTs, latestTs);
        rows.sort((a, b) => a.ts - b.ts);
        const s = rows.map((r) => {
          const raw = r.raw || {};
          const open = toNum(rawGet(raw, 'Open 1 day', 'Open', 'open'));
          const high = toNum(rawGet(raw, 'High 1 day', 'High', 'high'));
          const low = toNum(rawGet(raw, 'Low 1 day', 'Low', 'low'));
          const close = r.price != null ? r.price : toNum(rawGet(raw, 'Price', 'Close', 'close'));
          return { ts: r.ts, open, high, low, close, volume: r.volume };
        }).filter((x) => x.close != null);
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
        </div>
        <div className="chart-area">
          <div className="chart-header">
            {/* chart header left intentionally minimal (Open/Low/High removed per request) */}
          </div>

          <div className="sparkline">
            <svg width="100%" height="100%" viewBox="0 0 600 140" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={pct >= 0 ? '#6fe987' : '#ff9a9a'} stopOpacity="0.36" />
                  <stop offset="100%" stopColor="#071014" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* dynamic path will be constructed from series; fallback placeholder if no data */}
              {series && series.length > 0 ? (
                (() => {
                  // build a simple path from close prices
                  const xs = series.map((s) => s.ts);
                  const ys = series.map((s) => s.close);
                  const minX = Math.min(...xs);
                  const maxX = Math.max(...xs);
                  const minY = Math.min(...ys);
                  const maxY = Math.max(...ys);
                  const mapX = (t) => (maxX === minX ? 0 : ((t - minX) / (maxX - minX)) * 600);
                  const mapY = (p) => (maxY === minY ? 70 : 140 - ((p - minY) / (maxY - minY)) * 120);
                  const d = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${mapX(s.ts).toFixed(2)},${mapY(s.close).toFixed(2)}`).join(' ');
                  const closeFillPath = d + ` L 600 140 L 0 140 Z`;
                  return (
                    <g>
                      <path d={closeFillPath} fill="url(#areaGrad)" stroke={pct >= 0 ? '#23c55e' : '#ff4d4d'} strokeWidth="2" fillOpacity="0.9" />
                      {/* annotate last close */}
                      <circle cx={mapX(series[series.length - 1].ts)} cy={mapY(series[series.length - 1].close)} r="4" fill={pct >= 0 ? '#23c55e' : '#ff6b6b'} />
                      <text x={mapX(series[series.length - 1].ts)} y={mapY(series[series.length - 1].close) - 8} fontSize="12" fill={pct >= 0 ? '#baf3c9' : '#ffb6b6'} textAnchor="middle">{series[series.length - 1].close}</text>
                    </g>
                  );
                })()
              ) : (
                <g>
                  <path d="M0,60 C80,40 160,80 240,50 320,30 400,70 480,40 560,30 600,36 L600,140 L0,140 Z" fill="url(#areaGrad)" stroke={pct >= 0 ? '#23c55e' : '#ff4d4d'} strokeWidth="2" fillOpacity="0.9" />
                </g>
              )}
            </svg>
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

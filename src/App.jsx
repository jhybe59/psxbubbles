import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useCoins } from './hooks/useCoins'
import useStocks from './hooks/useStocks'
import Controls from './components/Controls'
import CoinModal from './components/CoinModal'
import BubbleChart from './components/BubbleChart'
import PillMenu from './components/PillMenu'
import SearchPopover from './components/SearchPopover'
import { createRadiusScale } from './utils/scales'
import storage from './lib/storage'
import './App.css'

function App() {
  const { coins, loading, error, topN, setTopN, reload } = useCoins(1000, 60000)
  const [liveMode, setLiveMode] = useState(false);
  const { stocks, lastUpdated, connected, computeAll, backfill24h, backfillStatus, fetchSymbols } = useStocks({ enabled: liveMode, retentionDays: 1 });
  const [fetchedCount, setFetchedCount] = useState(null);
  const [fetchedDetails, setFetchedDetails] = useState(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [snapshotCount, setSnapshotCount] = useState(null);
  const [snapshotSample, setSnapshotSample] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [aggregations, setAggregations] = useState(null);
  const [query, setQuery] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showControls, setShowControls] = useState(false)
  const chartRef = useRef(null)
  const [singleView, setSingleView] = useState(false)
  const [currentInterval, setCurrentInterval] = useState('Day')
  const [pillMenuOpen, setPillMenuOpen] = useState(false)
  const [pillAnchor, setPillAnchor] = useState(null)
  const [pillSelections, setPillSelections] = useState({ size: 'Performance', content: 'Performance', color: 'Performance' })
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchAnchor, setSearchAnchor] = useState(null)
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [selectedCoin, setSelectedCoin] = useState(null)
  const [pageIndex, setPageIndex] = useState(null) // null = no page filter
  
  // load favorites from localStorage; store array of coin ids
  const [favorites] = useState(() => {
    try {
      const raw = localStorage.getItem('favorites');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // helper: approximate interval percentage from available 24h percent
  // NOTE: When only a 24h percentage is available we approximate other
  // intervals (e.g. Hour ~ pct24h / 24, Week ~ pct24h * 7). This is an
  // approximation and should be replaced with real interval data when
  // available.
  function approxPctForInterval(interval, pct24h) {
    if (pct24h == null) return 0;
    switch (interval) {
      case 'Hour':
        return pct24h / 24;
      case 'Day':
        return pct24h;
      case 'Week':
        return pct24h * 7;
      case 'Month':
        return pct24h * 30;
      case 'Year':
        return pct24h * 365;
      case '5 Min':
        return pct24h / (24 * 60 / 5);
      case '1 Min':
        return pct24h / (24 * 60);
      case '15 Min':
        return pct24h / (24 * 60 / 15);
      default:
        return pct24h;
    }
  }

  // compute average percentage across favorites for a given interval
  function avgFavPctForInterval(interval) {
    const favList = (favorites && favorites.length) ? favorites : coins.slice(0, 10).map(c => c.id);
    const favCoins = coins.filter((c) => favList.includes(c.id));
    if (!favCoins.length) return 0;
    const vals = favCoins.map((c) => approxPctForInterval(interval, c.price_change_percentage_24h || 0));
    const sum = vals.reduce((s, v) => s + v, 0);
    return sum / vals.length;
  }

  // helper: map interval string to milliseconds
  function intervalToMs(interval) {
    switch (interval) {
      case '1 Min': return 60 * 1000;
      case '5 Min': return 5 * 60 * 1000;
      case '15 Min': return 15 * 60 * 1000;
      case 'Hour': return 60 * 60 * 1000;
      case 'Day': return 24 * 60 * 60 * 1000;
      case 'Week': return 7 * 24 * 60 * 60 * 1000;
      case 'Month': return 30 * 24 * 60 * 60 * 1000;
      case 'Year': return 365 * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }

  // compute aggregations for current interval when liveMode is on
  useEffect(() => {
    let active = true;
    async function build() {
      if (!liveMode || !computeAll) {
        setAggregations(null);
        return;
      }
      try {
        const ms = intervalToMs(currentInterval);
        const map = await computeAll(ms);
        if (!active) return;
        setAggregations(map);
      } catch (e) {
        // ignore
      }
    }
    build();
    return () => { active = false; };
  }, [liveMode, computeAll, currentInterval, lastUpdated]);

  // Auto-run fetchSymbols when user enables Live mode so we immediately try to populate symbols
  useEffect(() => {
    let mounted = true;
    if (liveMode && fetchSymbols) {
      setFetchedCount('...');
      setFetchedDetails(null);
      fetchSymbols().then((res) => {
        if (!mounted) return;
        if (res && res.ok) {
          setFetchedCount(res.symbols.length);
          setFetchedDetails(res.attempts || null);
        } else {
          setFetchedCount('err');
          setFetchedDetails(res && res.attempts ? res.attempts : (res && res.error ? [{ method: 'error', error: res.error }] : null));
          // open debug panel to surface errors
          setDebugOpen(true);
        }
      }).catch((e) => {
        if (!mounted) return;
        setFetchedCount('err');
        setFetchedDetails([{ method: 'exception', error: String(e && e.message ? e.message : e) }]);
        setDebugOpen(true);
      });
    }
    return () => { mounted = false; };
  }, [liveMode, fetchSymbols]);

  // map pct to color (green -> red). We'll generate a subtle gradient:
  // - if pct > 0 => green shades; if pct < 0 => red shades; neutral => dark
  function pctToColor(pct) {
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    // normalize to -100 .. 100
    const v = clamp(pct, -100, 100);
    if (v === 0) return 'rgba(255,255,255,0.04)';
    if (v > 0) {
      // map 0..10..100 to light->deep green
      const t = clamp(v / 10, 0, 1); // 0..1 for up to ~10%
      const r = Math.round(46 - 20 * t);
      const g = Math.round(200 + 40 * t);
      const b = Math.round(80 - 30 * t);
      return `rgb(${r},${g},${b})`;
    }
    // negative
    const t = clamp(Math.abs(v) / 10, 0, 1);
    const r = Math.round(220 + 20 * t);
    const g = Math.round(100 - 50 * t);
    const b = Math.round(100 - 30 * t);
    return `rgb(${r},${g},${b})`;
  }

  const filtered = useMemo(() => {
    if (!query) return coins
    const q = query.toLowerCase()
    return coins.filter((c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q))
  }, [coins, query])

  // apply page filter if selected (pageIndex maps to 0 => 1-100, 1 => 101-200 ...)
  // NOTE: when a specific page is selected we slice the full `coins` array
  // so the page buckets remain stable (1-100, 101-200, ...) even if a
  // search query is active. When no page is selected we respect the search
  // and return the filtered results.
  const displayedCoins = useMemo(() => {
    const per = 100;
    if (pageIndex == null) return filtered;
    const start = pageIndex * per;
    return coins.slice(start, start + per);
  }, [filtered, coins, pageIndex]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setShowControls(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // compute max absolute percent change for percent-based sizing
  const maxAbsChange = coins && coins.length ? Math.max(...coins.map(c => Math.abs(c.price_change_percentage_24h || 0))) : 1;
  // Use a much smaller max radius and near-linear gamma for testing to avoid huge bubbles
  const radiusScale = useMemo(() => createRadiusScale(maxAbsChange, 8, 72, 1.05), [maxAbsChange]);

  // Refresh snapshot info from IndexedDB for debug panel
  async function refreshSnapshotInfo() {
    try {
      await storage.initDB();
      const cnt = await storage.countSnapshots();
      setSnapshotCount(cnt);
      const latest = await storage.getLatestAll();
      // take first 20 samples
      setSnapshotSample((latest || []).slice(0, 20));
    } catch (e) {
      setSnapshotCount(-1);
      setSnapshotSample(null);
    }
  }

  // small built-in demo symbol set used as a fallback when live fetch fails
  const demoSymbols = [
    { symbol: 'AABS', price: 12.34, ts: Date.now(), volume: 1000 },
    { symbol: 'AASM', price: 4.56, ts: Date.now(), volume: 200 },
    { symbol: 'ABL', price: 78.9, ts: Date.now(), volume: 5000 },
    { symbol: 'ACI', price: 1.23, ts: Date.now(), volume: 50 },
    { symbol: 'ALNRS', price: 9.87, ts: Date.now(), volume: 300 }
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="logo-mark" aria-hidden="true"></span>
          <h1>PSX BUBBLES</h1>
        </div>

        <div className="header-actions">
          <button
            className="view-toggle"
            title="Toggle single/multi view"
            onClick={() => setSingleView((s) => !s)}
            aria-pressed={singleView}
          >
            {singleView ? 'Show All' : 'Single'}
          </button>
          <button
            className="search-icon"
            title="Search"
            aria-label="Open search"
            onClick={(e) => { setSearchAnchor(e.currentTarget.getBoundingClientRect()); setSearchOpen(true); }}
          >
            🔍
          </button>

          <button
            className="search-icon"
            title="Refresh data"
            aria-label="Refresh data"
            onClick={() => reload()}
          >
            ⟳
          </button>
          <button
            className="view-toggle"
            title={liveMode ? 'Live mode ON' : 'Demo mode'}
            onClick={() => setLiveMode((s) => !s)}
            aria-pressed={liveMode}
          >
            {liveMode ? 'Live' : 'Demo'}
          </button>
          <button
            className="view-toggle"
            title="Open debug panel"
            onClick={() => setDebugOpen((s) => !s)}
          >
            Debug
          </button>
          <button
            className="view-toggle"
            title="Backfill 24h"
            onClick={() => {
              if (backfillStatus && backfillStatus.running) return;
              if (backfill24h) backfill24h({ batchSize: 12, delayMs: 600 });
            }}
          >
            ⤓ Backfill
          </button>
          <button
            className="view-toggle"
            title="Fetch symbols (debug)"
            onClick={async () => {
              if (!fetchSymbols) return;
              setFetchedCount('...');
              setFetchedDetails(null);
              setUsingFallback(false);
              // timeout the fetchSymbols call after 5s so UI doesn't hang
              try {
                const res = await Promise.race([
                  fetchSymbols(),
                  new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
                ]);
                if (res && res.ok) {
                  setFetchedCount(res.symbols.length);
                  setFetchedDetails(res.attempts || null);
                } else {
                  setFetchedCount(res && res.symbols ? res.symbols.length : `err`);
                  setFetchedDetails(res && res.attempts ? res.attempts : (res && res.error ? [{ method: 'error', error: res.error }] : null));
                  setUsingFallback(true);
                }
              } catch (e) {
                setFetchedCount('err');
                setFetchedDetails([{ method: 'error', error: String(e && e.message ? e.message : e) }]);
                setUsingFallback(true);
              }
            }}
          >
            Fetch symbols
          </button>
        </div>
      </header>

      {/* pill row below header (centered) */}
      <div className="pill-row">
          <div className="pills">
          {['Hour','Day','Week','Month','Year','5 Min','1 Min','15 Min'].map((p) => {
            const pct = avgFavPctForInterval(p);
            const bg = pctToColor(pct);
            return (
              <button
                key={p}
                className={`pill ${p === currentInterval ? 'active' : ''}`}
                style={{ background: bg }}
                title={`${pct.toFixed(2)}% avg`}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  // If user clicks the already-selected interval, toggle/open the menu on second click
                  if (p === currentInterval) {
                    if (!pillMenuOpen) {
                      setPillAnchor(rect);
                      setPillMenuOpen(true);
                    } else {
                      setPillMenuOpen(false);
                    }
                  } else {
                    // First click on a different interval: select it (visual feedback), but don't open the menu
                    setCurrentInterval(p);
                    // update anchor so a quick second click will open the menu in the right spot
                    setPillAnchor(rect);
                    setPillMenuOpen(false);
                  }
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>
      {/* Pill popover menu (opens when a pill is clicked) */}
      {pillMenuOpen && (
        <PillMenu
          anchorRect={pillAnchor}
          onClose={() => setPillMenuOpen(false)}
          currentInterval={currentInterval}
          setCurrentInterval={setCurrentInterval}
          selections={pillSelections}
          setSelections={setPillSelections}
        />
      )}

      {searchOpen && (
        <SearchPopover
          coins={liveMode ? stocks.map(s => ({ id: s.symbol, name: s.symbol, symbol: s.symbol, price: s.price })) : coins}
          anchorRect={searchAnchor}
          onSelect={(c) => setSelectedCoin(c)}
          onClose={() => setSearchOpen(false)}
        />
      )}

      <main className="main">
        <section className="viz">
          <BubbleChart
            ref={chartRef}
            data={(() => {
              if (liveMode) {
                if (usingFallback) return demoSymbols.map(s => ({ id: s.symbol, name: s.symbol, symbol: s.symbol, price: s.price, market_cap: s.value || 0, volume: s.volume, price_change_percentage_24h: 0 }));
                return (stocks || []).map(s => ({ id: s.symbol, name: s.symbol, symbol: s.symbol, price: s.price, market_cap: s.value, volume: s.volume, price_change_percentage_24h: s.raw && (s.raw.pch != null ? s.raw.pch * 100 : s.raw.changePercent) }));
              }
              return displayedCoins;
            })()}
            className="bubble-chart"
            single={singleView}
            radiusScale={radiusScale}
            currentInterval={currentInterval}
            selections={pillSelections}
            aggregations={aggregations}
            onSelectCoin={(coin) => setSelectedCoin(coin)}
          />
        </section>
      </main>

      <footer className="footer">Built for learning</footer>

      {/* controls slide-over removed; header refresh button replaces it */}

      {/* Floating bottom toolbars similar to sample */}
      <div className="floating-left">
        {(() => {
          const per = 100;
          const label = pageIndex == null ? 'Favorites' : `${pageIndex * per + 1} - ${(pageIndex + 1) * per}`;
          return (
            <div className="floating-card" onClick={() => setFavoritesOpen((s) => !s)} style={{cursor:'pointer'}}>
              ★ {label} ▾
            </div>
          );
        })()}

        {favoritesOpen && (
          <div className="favorites-menu">
            <div className="menu-section">
              <div className="menu-title">Pages <span className="interval">{currentInterval}</span></div>
              <div className="menu-list">
                {/* All row */}
                <div className={`menu-row ${pageIndex === null ? 'active' : ''}`} onClick={() => setPageIndex(null)}>
                  <input type="radio" readOnly checked={pageIndex === null} />
                  <span className="menu-label">All</span>
                  <span className={`menu-pct`}>{''}</span>
                </div>
                {(() => {
                  const per = 100;
                  const pageCount = 10; // fixed 1..1000 as requested
                  return Array.from({ length: pageCount }).map((_, i) => {
                    const start = i * per + 1;
                    const end = (i + 1) * per;
                    const chunk = coins.slice(i * per, (i + 1) * per);
                    const vals = chunk.map((c) => approxPctForInterval(currentInterval, c.price_change_percentage_24h || 0));
                    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
                    const sign = avg >= 0 ? '+' : '';
                    return (
                      <div key={i} className={`menu-row ${pageIndex === i ? 'active' : ''}`} onClick={() => setPageIndex(i)}>
                        <input type="radio" readOnly checked={pageIndex === i} />
                        <span className="menu-label">{`${start} - ${end}`}</span>
                        <span className={`menu-pct ${avg >= 0 ? 'pos' : 'neg'}`}>{`${sign}${avg.toFixed(2)}%`}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            <div className="menu-section">
              <div className="menu-title">Lists <span className="interval">{currentInterval}</span></div>
              <div className="menu-list">
                {(() => {
                  const listDefs = [
                    { id: 'favorites', label: 'Favorites', selector: () => favorites },
                    { id: '1-20', label: '1-20', selector: () => coins.slice(0, 20).map(c => c.id) },
                    { id: '30+', label: '30+', selector: () => coins.slice(29).map(c => c.id) },
                    { id: 'block', label: 'Blocklist', selector: () => [] }
                  ];
                  return listDefs.map((ld) => {
                    const ids = ld.selector();
                    const members = coins.filter((c) => ids.includes(c.id));
                    const vals = members.map((c) => approxPctForInterval(currentInterval, c.price_change_percentage_24h || 0));
                    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
                    const sign = avg >= 0 ? '+' : '';
                    return (
                      <div key={ld.id} className={`menu-row`}>
                        <input type="radio" readOnly checked={false} />
                        <span className="menu-label">{ld.label}</span>
                        <span className={`menu-pct ${avg > 0 ? 'pos' : 'neg'}`}>{avg == null ? '-' : `${sign}${avg.toFixed(2)}%`}</span>
                      </div>
                    );
                  })
                })()}
              </div>
            </div>
            <div className="menu-section">
              <div className="menu-title">Exchanges <span className="interval">{currentInterval}</span></div>
              <div className="menu-list">
                {(() => {
                  // list of common exchanges (order can be customized)
                  const exs = ['Binance','MEXC','Bybit','Kucoin','Gate','Bitget','BitMart','BingX','OKX','Coinbase','Crypto.com','Kraken'];
                  return exs.map((ex) => {
                    // try to find coins with matching exchange field (if present)
                    const members = coins.filter((c) => (c.exchange && c.exchange.toLowerCase() === ex.toLowerCase()));
                    const vals = members.map((c) => approxPctForInterval(currentInterval, c.price_change_percentage_24h || 0));
                    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
                    const sign = avg >= 0 ? '+' : '';
                    return (
                      <div key={ex} className={`menu-row`}>
                        <input type="radio" readOnly checked={false} />
                        <span className="menu-label">{ex}</span>
                        <span className={`menu-pct ${avg > 0 ? 'pos' : 'neg'}`}>{avg == null ? '-' : `${sign}${avg.toFixed(2)}%`}</span>
                      </div>
                    );
                  })
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="floating-right">
        <div className="floating-card" style={{cursor:'pointer'}} onClick={() => setDebugOpen(true)}>⚙️</div>
      </div>
      {/* Selected coin modal */}
      {selectedCoin && <CoinModal coin={selectedCoin} onClose={() => setSelectedCoin(null)} />}
      {/* Debug HUD (visible during local testing) */}
      <div style={{position:'fixed', right:12, bottom:12, background:'rgba(0,0,0,0.6)', color:'#fff', padding:'8px 10px', borderRadius:8, fontSize:12, zIndex:1200}}>
        <div style={{fontWeight:700}}>Debug</div>
  <div>{liveMode ? 'Stocks (live):' : 'Coins:'} {liveMode ? (stocks ? stocks.length : 0) : (coins ? coins.length : 0)}</div>
  <div>Displayed: {liveMode ? (stocks ? stocks.length : 0) : (displayedCoins ? displayedCoins.length : 0)}</div>
  <div>WS: {connected ? 'connected' : 'disconnected'} {lastUpdated ? `• ${new Date(lastUpdated).toLocaleTimeString()}` : ''}</div>
  <div>Max |%|: {typeof maxAbsChange === 'number' ? maxAbsChange.toFixed(2) : String(maxAbsChange)}</div>
      {backfillStatus && (
    <div style={{marginTop:6}}>
      <div style={{fontSize:11, opacity:0.9}}>Backfill: {backfillStatus.running ? 'running' : (backfillStatus.done ? 'idle' : 'none')}</div>
      <div style={{fontSize:11}}>{`Done: ${backfillStatus.done}/${backfillStatus.total} ${backfillStatus.current ? `• current: ${backfillStatus.current}` : ''} ${backfillStatus.errors ? `• errors: ${backfillStatus.errors}` : ''}`}</div>
      {backfillStatus.lastError && <div style={{fontSize:11, color:'#ff8a80'}}>{`Err: ${backfillStatus.lastError}`}</div>}
      {fetchedCount != null && <div style={{fontSize:11}}>{`Fetched symbols: ${fetchedCount}`}</div>}
      {fetchedDetails && Array.isArray(fetchedDetails) && (
        <div style={{fontSize:10, marginTop:6, maxHeight:120, overflow:'auto'}}>
          {fetchedDetails.map((d, i) => (
            <div key={i} style={{paddingTop:2}}>{`${d.method || d.url || 'item'}: ${d.ok ? `ok (${d.status||'200'})` : (d.error || JSON.stringify(d.body) || 'failed')}`}</div>
          ))}
        </div>
      )}
      {backfillStatus.running && <div style={{height:6, background:'rgba(255,255,255,0.08)', borderRadius:4, marginTop:6}}>
        <div style={{height:6, background:'#4caf50', width: `${Math.round((backfillStatus.done / Math.max(1, backfillStatus.total)) * 100)}%`, borderRadius:4}} />
      </div>}
    </div>
  )}
      </div>
      {/* Debug Panel Modal */}
      {debugOpen && (
        <div style={{position:'fixed', right:12, bottom:80, width:420, maxHeight:'70vh', background:'#0b1220', color:'#fff', padding:12, borderRadius:8, boxShadow:'0 8px 30px rgba(0,0,0,0.7)', zIndex:1300, overflow:'auto'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
            <strong>Debug Panel</strong>
            <div style={{display:'flex', gap:8}}>
              <button onClick={() => setDebugOpen(false)} style={{background:'transparent', color:'#fff', border:'1px solid rgba(255,255,255,0.06)', padding:'4px 8px', borderRadius:6}}>Close</button>
            </div>
          </div>
          <div style={{fontSize:13, marginBottom:8}}>WS: {connected ? 'connected' : 'disconnected'} {lastUpdated ? `• ${new Date(lastUpdated).toLocaleTimeString()}` : ''}</div>
          <div style={{marginBottom:8}}>
            <button onClick={async () => {
              setFetchedCount('...');
              setFetchedDetails(null);
              try {
                const res = await Promise.race([
                  fetchSymbols(),
                  new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
                ]);
                if (res && res.ok) { setFetchedCount(res.symbols.length); setFetchedDetails(res.attempts || null); }
                else { setFetchedCount('err'); setFetchedDetails(res && res.attempts ? res.attempts : [{method:'error', error: res && res.error}]); setUsingFallback(true); }
              } catch (e) { setFetchedCount('err'); setFetchedDetails([{method:'error', error: String(e && e.message ? e.message : e)}]); setUsingFallback(true); }
            }} style={{marginRight:8}}>Run Fetch Symbols</button>
            <button onClick={async () => { if (backfill24h) { setUsingFallback(false); await backfill24h({ batchSize: 20, delayMs: 700 }); await refreshSnapshotInfo(); } }} style={{marginRight:8}}>Start Backfill</button>
            <button onClick={async () => await refreshSnapshotInfo()}>Refresh Snapshots</button>
            <button onClick={() => { setUsingFallback(true); }} style={{marginLeft:8}}>Use demo fallback</button>
          </div>
          <div style={{fontSize:12, marginBottom:6}}>Backfill: {backfillStatus.running ? 'running' : (backfillStatus.done ? 'idle' : 'none')}</div>
          <div style={{fontSize:12, color:'#ffdcdc', marginBottom:6}}>{`Done: ${backfillStatus.done} / ${backfillStatus.total} • errors: ${backfillStatus.errors}`}</div>
          {backfillStatus.lastError && <div style={{fontSize:12, color:'#ff8a80', marginBottom:6}}>{`LastErr: ${backfillStatus.lastError}`}</div>}
          <div style={{fontSize:12, marginBottom:6}}><strong>Fetched symbols:</strong> {fetchedCount == null ? '-' : fetchedCount}</div>
          {fetchedDetails && Array.isArray(fetchedDetails) && (
            <div style={{fontSize:11, maxHeight:140, overflow:'auto', background:'#071017', padding:6, borderRadius:6, marginBottom:8}}>
              {fetchedDetails.map((d, i) => (
                <div key={i} style={{padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
                  <div style={{fontSize:11}}><strong>{d.method || d.url || 'item'}</strong> — {d.ok ? `ok (${d.status||'200'})` : (d.error || JSON.stringify(d.body) || 'failed')}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{fontSize:12, marginBottom:6}}><strong>Snapshots:</strong> {snapshotCount == null ? '-' : snapshotCount}</div>
          {snapshotSample && Array.isArray(snapshotSample) && (
            <div style={{fontSize:11, maxHeight:180, overflow:'auto', background:'#071017', padding:6, borderRadius:6}}>
              {snapshotSample.map((s, i) => (
                <div key={i} style={{padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.02)'}}>
                  <div style={{fontSize:12}}><strong>{s.symbol}</strong> @ {s.price} • {new Date(s.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App

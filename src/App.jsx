import React, { useState, useMemo, useEffect, useRef } from 'react'
import useOHLCV from './hooks/useOHLCV'
import useStocks from './hooks/useStocks'
import Controls from './components/Controls'
import CoinModal from './components/CoinModal'
import BubbleChart from './components/BubbleChart'
import PillMenu from './components/PillMenu'
import SearchPopover from './components/SearchPopover'
import IndexManager from './components/IndexManager'
import CsvPanel from './components/CsvPanel'
import SymbolsPanel from './components/SymbolsPanel'
import PriceRange from './components/PriceRange'
import SnapshotPanel from './components/SnapshotPanel'
import { createRadiusScale } from './utils/scales'
import storage from './lib/storage'
import './App.css'
import { getAllMetadata } from './hooks/useSymbolMetadata'

function App() {
  const { coins, loading, error, importSnapshotsIfNeeded, refreshForInterval } = useOHLCV();
  const [snapCount, setSnapCount] = useState(null);
  // Demo-only app: no live mode or external fetches. Keep demo data only.
  const liveMode = false;
  const { stocks, lastUpdated, connected } = useStocks({ enabled: false, retentionDays: 1 });
  const [query, setQuery] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showControls, setShowControls] = useState(false)
  const chartRef = useRef(null)
  const [singleView, setSingleView] = useState(false)
  const [currentInterval, setCurrentInterval] = useState('Day')
  const [pillMenuOpen, setPillMenuOpen] = useState(false)
  const aggregations = null; // demo-only: no live aggregations
  const [pillAnchor, setPillAnchor] = useState(null)
  const [pillSelections, setPillSelections] = useState({ size: 'Performance', content: 'Performance', color: 'Performance' })
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchAnchor, setSearchAnchor] = useState(null)
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [selectedCoin, setSelectedCoin] = useState(null)
  const [pageIndex, setPageIndex] = useState(() => {
    try {
      const v = localStorage.getItem('pageIndex');
      return v !== null ? Number(v) : null;
    } catch {
      return null;
    }
  }) // null = no page filter
  const [selectedIndex, setSelectedIndex] = useState(() => {
    try {
      const v = localStorage.getItem('selectedIndex');
      return v !== null ? v : null;
    } catch {
      return null;
    }
  })
  const [indexMap, setIndexMap] = useState(() => {
    try {
      const raw = localStorage.getItem('indexMap');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })

  // DEBUG: log indexMap and raw localStorage key to help diagnose missing indices
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.info('[App] indexMap loaded/updated:', indexMap);
      // eslint-disable-next-line no-console
      console.info('[App] localStorage.indexMap raw:', localStorage.getItem('indexMap'));
    } catch (e) {
      // ignore
    }
  }, [indexMap]);
  // Price range filtering state: start as full discrete marks (1..Infinity)
  const [priceRange, setPriceRange] = useState([1, Number.POSITIVE_INFINITY])
  const [symbolsPanelOpen, setSymbolsPanelOpen] = useState(false)
  
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

  // No live-mode effects in demo-only state.

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
    // compute visible coins by excluding metadata-hidden symbols
    const meta = getAllMetadata();
    const visible = (coins || []).filter((c) => !(meta[c.symbol] && meta[c.symbol].hidden));
    if (!query) return visible;
    const q = query.toLowerCase();
    return visible.filter((c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
  }, [coins, query])

  // apply page filter if selected (pageIndex maps to 0 => 1-100, 1 => 101-200 ...)
  // NOTE: when a specific page is selected we slice the full `coins` array
  // so the page buckets remain stable (1-100, 101-200, ...) even if a
  // search query is active. When no page is selected we respect the search
  // and return the filtered results.
  const displayedCoins = useMemo(() => {
    const per = 100;
    const [pmin, pmax] = priceRange || [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
    // If an index is selected, ignore page buckets and show only index members
    if (selectedIndex) {
      const members = indexMap && indexMap[selectedIndex] ? new Set((indexMap[selectedIndex] || []).map(s => s.toLowerCase())) : null;
      if (!members) return [];
      return filtered
        .filter((c) => members.has((c.symbol || c.id || '').toLowerCase()))
        .filter((c) => {
          const p = Number(c.price == null ? c.close || 0 : c.price);
          return !Number.isNaN(p) && p >= pmin && p <= pmax;
        });
    }
    if (pageIndex == null) {
      return filtered.filter((c) => {
        const p = Number(c.price == null ? c.close || 0 : c.price);
        return !Number.isNaN(p) && p >= pmin && p <= pmax;
      });
    }
    const start = pageIndex * per;
    // use visible coins for paging so hidden symbols don't occupy slots
    const meta = getAllMetadata();
    const visible = (coins || []).filter((c) => !(meta[c.symbol] && meta[c.symbol].hidden));
    return visible.slice(start, start + per).filter((c) => {
      const p = Number(c.price == null ? c.close || 0 : c.price);
      return !Number.isNaN(p) && p >= pmin && p <= pmax;
    });
  }, [filtered, coins, pageIndex, selectedIndex, indexMap, priceRange]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setShowControls(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // when the user switches interval, ask OHLCV hook to refresh computed interval values
  useEffect(() => {
    try {
      if (refreshForInterval) refreshForInterval(currentInterval);
    } catch (e) {
      // ignore
    }
  }, [currentInterval, refreshForInterval]);

  // read snapshot count for header status periodically
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await importSnapshotsIfNeeded(false);
        if (mounted && res && res.count != null) setSnapCount(res.count);
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false };
  }, [importSnapshotsIfNeeded]);

  // compute max absolute percent change for percent-based sizing
  const maxAbsChange = coins && coins.length ? Math.max(...coins.map(c => Math.abs(c.price_change_percentage_24h || 0))) : 1;
  // Use a much smaller max radius and near-linear gamma for testing to avoid huge bubbles
  const radiusScale = useMemo(() => createRadiusScale(maxAbsChange, 8, 72, 1.05), [maxAbsChange]);

  // Snapshot refresh not exposed in demo-only UI

  // small built-in demo symbol set used as a fallback when live fetch fails
  const demoSymbols = [
    { symbol: 'AABS', price: 12.34, ts: Date.now(), volume: 1000 },
    { symbol: 'AASM', price: 4.56, ts: Date.now(), volume: 200 },
    { symbol: 'ABL', price: 78.9, ts: Date.now(), volume: 5000 },
    { symbol: 'ACI', price: 1.23, ts: Date.now(), volume: 50 },
    { symbol: 'ALNRS', price: 9.87, ts: Date.now(), volume: 300 }
  ];

  const [indexManagerOpen, setIndexManagerOpen] = useState(false)
  const [snapshotPanelOpen, setSnapshotPanelOpen] = useState(false)
  

  // persist page/index selection so UI returns to last state across refreshes
  useEffect(() => {
    try {
      if (pageIndex == null) localStorage.removeItem('pageIndex');
      else localStorage.setItem('pageIndex', String(pageIndex));
    } catch (e) { /* ignore */ }
  }, [pageIndex]);

  useEffect(() => {
    try {
      if (selectedIndex == null) localStorage.removeItem('selectedIndex');
      else localStorage.setItem('selectedIndex', String(selectedIndex));
    } catch (e) { /* ignore */ }
  }, [selectedIndex]);

  // NOTE: priceRange is discrete via PriceRange marks (1,10,100,500,1000+).
  // We intentionally don't override user selection on coins load so the
  // marks-based slider remains stable and predictable.

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
            onClick={() => refreshForInterval && refreshForInterval(currentInterval)}
          >
            ⟳
          </button>
          <button
            className="search-icon"
            title="Symbols"
            aria-label="Symbols panel"
            onClick={() => setSymbolsPanelOpen(true)}
          >
            ☰
          </button>
          <div style={{marginLeft:12, color:'#9fb8b0', fontSize:12}}>
            {loading ? 'Loading snapshots...' : (snapCount != null ? `${snapCount} snapshots` : '')}
            {error ? ` — ${error}` : ''}
            <button style={{marginLeft:8}} onClick={() => importSnapshotsIfNeeded && importSnapshotsIfNeeded(true)}>Re-import</button>
            <button style={{marginLeft:8}} onClick={() => setSnapshotPanelOpen(true)}>Snapshots ▾</button>
          </div>
          {/* Demo-only: removed Live, Debug, Backfill and Fetch controls */}
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
                {/* small colored swatch to show per-period avg color (keeps button visuals consistent) */}
                <span className="pill-swatch" style={{ background: bg }} aria-hidden="true" />
                <span className="pill-label">{p}</span>
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
          // pass helpers so the menu can render per-period colors consistently
          avgFavPctForInterval={avgFavPctForInterval}
          pctToColor={pctToColor}
        />
      )}

      {searchOpen && (
        <SearchPopover
          coins={liveMode ? stocks.map(s => ({ id: s.symbol, name: s.symbol, symbol: s.symbol, price: s.price })) : ((() => { const m = getAllMetadata(); return (coins || []).filter((c) => !(m[c.symbol] && m[c.symbol].hidden)); })())}
          anchorRect={searchAnchor}
          onSelect={(c) => setSelectedCoin(c)}
          onClose={() => setSearchOpen(false)}
        />
      )}

      <main className="main">
        <section className="viz">
          {(!coins || coins.length === 0) ? (
            <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',color:'#9fb8b0'}}>
              <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>No chart data available</div>
              <div style={{marginBottom:8}}>Snapshots in DB: {snapCount != null ? snapCount : 'unknown'}</div>
              <div style={{marginBottom:12}}>If this stays blank: open DevTools → Application → IndexedDB → `psx-snapshots-db` and check `snapshots` store.</div>
              <div>
                <button onClick={() => importSnapshotsIfNeeded && importSnapshotsIfNeeded(true)} style={{marginRight:8}}>Re-import snapshots</button>
                <button onClick={() => refreshForInterval && refreshForInterval(currentInterval)}>Refresh interval</button>
              </div>
            </div>
          ) : (
            <BubbleChart
              ref={chartRef}
              data={(() => {
                // when using OHLCV data the hook returns objects shaped for the chart
                const meta = getAllMetadata();
                const src = displayedCoins && displayedCoins.length ? displayedCoins : (coins || []);
                // merge metadata (image, displayName, shortName) into each coin so BubbleChart can render logos
                return (src || []).map((c) => {
                  try {
                    const key = (c.symbol || c.id || '').toString();
                    const m = meta[key] || {};
                    return Object.assign({}, c, { image: m.image || c.image, displayName: m.displayName || c.displayName, shortName: m.shortName || c.shortName });
                  } catch (e) {
                    return c;
                  }
                });
              })()}
              selectedIndex={selectedIndex}
              className="bubble-chart"
              single={singleView}
              radiusScale={radiusScale}
              currentInterval={currentInterval}
              selections={pillSelections}
              aggregations={aggregations}
              onSelectCoin={(coin) => setSelectedCoin(coin)}
            />
          )}
        </section>
      </main>

      <footer className="footer">
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,width:'100%'}}>
          <PriceRange
            marks={[
              { value: 1, label: '1' },
              { value: 10, label: '10' },
              { value: 100, label: '100' },
              { value: 500, label: '500' },
              { value: 1000, label: '1000+', open: true }
            ]}
            value={priceRange}
            onChange={(v) => setPriceRange(v)}
          />
        </div>
      </footer>

      {/* controls slide-over removed; header refresh button replaces it */}

      {/* Floating bottom toolbars similar to sample */}
      <div className="floating-left">
        {(() => {
          const per = 100;
          const floatingLabel = (() => {
            if (selectedIndex) return selectedIndex;
            if (pageIndex == null) return 'All';
            const start = pageIndex * per + 1;
            const end = Math.min((pageIndex + 1) * per, (coins && coins.length) ? coins.length : (pageIndex + 1) * per);
            return `${start} - ${end}`;
          })();
          return (
            <div className="floating-card" onClick={() => setFavoritesOpen((s) => !s)} style={{cursor:'pointer'}}>
              ★ {floatingLabel} ▾
            </div>
          );
        })()}

        {favoritesOpen && (
          <div className="favorites-menu">
            <div className="menu-section">
              <div className="menu-title">Pages <span className="interval">{currentInterval}</span></div>
              <div className="menu-list">
                {/* All row */}
                <button className={`menu-row ${(pageIndex === null && !selectedIndex) ? 'active' : ''}`} onClick={() => { setSelectedIndex(null); setPageIndex(null); }} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'transparent',border:'none',textAlign:'left',width:'100%',padding:'6px 8px'}}>
                  <input type="radio" readOnly checked={(pageIndex === null && !selectedIndex)} />
                  <span className="menu-label">All</span>
                  <span className={`menu-pct`}>{''}</span>
                </button>
                {(() => {
                  const per = 100;
                  const total = (coins && coins.length) ? coins.length : 0;
                  const pageCount = Math.max(1, Math.ceil(total / per));
                  return Array.from({ length: pageCount }).map((_, i) => {
                    const start = i * per + 1;
                    const end = Math.min((i + 1) * per, total || (i + 1) * per);
                    const chunk = coins.slice(i * per, (i + 1) * per);
                    const vals = chunk.map((c) => approxPctForInterval(currentInterval, c.price_change_percentage_24h || 0));
                    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
                    const sign = avg >= 0 ? '+' : '';
                    return (
                      <button key={i} className={`menu-row ${(pageIndex === i && !selectedIndex) ? 'active' : ''}`} onClick={() => { setSelectedIndex(null); setPageIndex(i); }} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'transparent',border:'none',textAlign:'left',flex: '1 1 auto',padding:'6px 8px'}}>
                        <input type="radio" readOnly checked={(pageIndex === i && !selectedIndex)} />
                        <span className="menu-label">{`${start} - ${end}`}</span>
                        <span className={`menu-pct ${avg >= 0 ? 'pos' : 'neg'}`}>{`${sign}${avg.toFixed(2)}%`}</span>
                      </button>
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
                      <div key={ld.id} className={`menu-row`} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
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
              <div className="menu-title">Indices <span className="interval">{currentInterval}</span></div>
              <div className="menu-list">
                {(() => {
                  // index list for PSX/stocks
                  const indices = ['KSE 100','KSE 30','ALLSHR','KMI 30','KMIALLSHR'];
                  return indices.map((ix) => {
                    const membersIds = indexMap && indexMap[ix] ? (indexMap[ix] || []) : [];
                    // try to match by symbol or id (case-insensitive)
                    const membersSet = new Set(membersIds.map(s => (''+s).toLowerCase()));
                    const members = membersIds.length ? coins.filter((c) => membersSet.has((c.symbol || c.id || '').toLowerCase())) : [];
                    const vals = members.map((c) => approxPctForInterval(currentInterval, c.price_change_percentage_24h || 0));
                    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
                    const sign = avg >= 0 ? '+' : '';
                    return (
                      <div key={ix} className={`menu-row ${selectedIndex === ix ? 'active' : ''}`} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <button onClick={() => { setSelectedIndex(selectedIndex === ix ? null : ix); setPageIndex(null); }} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'transparent',border:'none',textAlign:'left',flex: '1 1 auto',padding:'6px 8px'}}>
                          <input type="radio" readOnly checked={selectedIndex === ix} />
                          <span className="menu-label">{ix}</span>
                          <span className={`menu-pct ${avg > 0 ? 'pos' : 'neg'}`}>{avg == null ? '-' : `${sign}${avg.toFixed(2)}%`}</span>
                        </button>
                        <button
                          title={`Open Index Manager for ${ix}`}
                          onClick={(e) => { e.stopPropagation(); setIndexManagerOpen(true); setSelectedIndex(ix); }}
                          style={{ marginLeft: 8, background: 'transparent', border: 'none', color: '#9fb8b0', cursor: 'pointer' }}
                        >✎</button>
                      </div>
                    );
                  })
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
      {indexManagerOpen && (
        <IndexManager
          open={indexManagerOpen}
          onClose={() => setIndexManagerOpen(false)}
          coins={coins}
          indexMap={indexMap}
          setIndexMap={setIndexMap}
        />
      )}
      {snapshotPanelOpen && (
        <SnapshotPanel open={snapshotPanelOpen} onClose={() => setSnapshotPanelOpen(false)} onImported={() => { importSnapshotsIfNeeded && importSnapshotsIfNeeded(false); refreshForInterval && refreshForInterval(currentInterval); }} />
      )}
      <CsvPanel refreshCallback={refreshForInterval} currentInterval={currentInterval} />

      {symbolsPanelOpen && (
        <SymbolsPanel
          open={symbolsPanelOpen}
          onClose={() => setSymbolsPanelOpen(false)}
          symbols={coins && coins.length ? coins : (demoSymbols || [])}
        />
      )}

      {/* Backup UI removed as requested */}

      {/* Debug control removed in demo-only reset */}
      {/* Selected coin modal */}
      {selectedCoin && <CoinModal coin={selectedCoin} onClose={() => setSelectedCoin(null)} />}
      {/* Debug HUD removed in demo-only reset */}
      {/* Debug Panel removed in demo-only reset */}
    </div>
  )
}

export default App

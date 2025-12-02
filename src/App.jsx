import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import useOHLCV from './hooks/useOHLCV'
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
import MarketSummary from './components/MarketSummary'
import useMarketStats from './hooks/useMarketStats'
import { createRadiusScale } from './utils/scales'
import './App.css'
import { getAllMetadata } from './hooks/useSymbolMetadata'
import { ENABLE_LIVE_API, AUTO_REFRESH_MS } from './config'
import { sanitizeIndexMap } from './utils/indexMap'

function App() {
  const { coins, loading, error, importSnapshotsIfNeeded, refreshForInterval, snapCount, latestTimestamp } = useOHLCV();
  const [query, setQuery] = useState('')
  const [showControls, setShowControls] = useState(false)
  const chartRef = useRef(null)
  const autoRefreshTimerRef = useRef(null)
  const refreshProgressTimerRef = useRef(null)
  const lastRefreshTimeRef = useRef(Date.now())
  const [refreshProgress, setRefreshProgress] = useState(0) // 0-100
  const [isProgressAnimating, setIsProgressAnimating] = useState(false) // Track if progress is animating
  const [currentInterval, setCurrentInterval] = useState('Day')
  const [pillMenuOpen, setPillMenuOpen] = useState(false)
  const aggregations = null; // demo-only: no live aggregations
  const [pillAnchor, setPillAnchor] = useState(null)
  const [pillSelections, setPillSelections] = useState({ size: 'Performance', content: 'Performance', color: 'Performance' })
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchAnchor, setSearchAnchor] = useState(null)
  const [initialSearchQuery, setInitialSearchQuery] = useState('')
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [dayIntervalMenuOpen, setDayIntervalMenuOpen] = useState(false)
  const [monthlyIntervalMenuOpen, setMonthlyIntervalMenuOpen] = useState(false)
  const dayIntervalAnchorRef = useRef(null)
  const monthlyIntervalAnchorRef = useRef(null)
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
      const parsed = raw ? JSON.parse(raw) : {};
      return sanitizeIndexMap(parsed);
    } catch {
      return {};
    }
  })

  const loadIndexMap = useCallback(async ({ silent = false } = {}) => {
    const applyMap = (data, source) => {
      if (!data || typeof data !== 'object') return null;
      const sanitized = sanitizeIndexMap(data);
      try { localStorage.setItem('indexMap', JSON.stringify(sanitized)); } catch (e) { /* ignore */ }
      setIndexMap(sanitized);
      return { ok: true, data: sanitized, source };
    };

    const attempts = [
      async () => {
        try {
          const res = await fetch('/api/index_map', { cache: 'no-cache' });
          if (!res || !res.ok) return null;
          const json = await res.json();
          const data = json && json.data && typeof json.data === 'object' ? json.data : json;
          return applyMap(data, 'api');
        } catch (err) {
          if (!silent) {
            try { console.warn('[App] Failed to load index map from API:', err); } catch (logErr) { /* ignore */ }
          }
          return null;
        }
      },
      async () => {
        try {
          const res = await fetch('/assets/migrated_index_map.json', { cache: 'no-cache' });
          if (!res || !res.ok) return null;
          const data = await res.json();
          return applyMap(data, 'asset');
        } catch (err) {
          if (!silent) {
            try { console.warn('[App] Failed to load index map asset:', err); } catch (logErr) { /* ignore */ }
          }
          return null;
        }
      }
    ];

    for (let i = 0; i < attempts.length; i += 1) {
      const result = await attempts[i]();
      if (result) return result;
    }

    if (!silent) {
      try { console.warn('[App] Unable to load index map from any source.'); } catch (logErr) { /* ignore */ }
    }
    return { ok: false };
  }, []);

  const handleIndexPublish = useCallback((payload) => {
    if (payload && typeof payload === 'object') {
      const sanitized = sanitizeIndexMap(payload);
      try { localStorage.setItem('indexMap', JSON.stringify(sanitized)); } catch (e) { /* ignore */ }
      setIndexMap(sanitized);
      return;
    }
    loadIndexMap({ silent: true });
  }, [loadIndexMap, setIndexMap])

  // Load the canonical index map from the admin API (with asset fallback) so
  // all clients converge on the same membership set.
  useEffect(() => {
    loadIndexMap();
  }, [loadIndexMap]);

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

  // Memoize the bubble chart data to prevent unnecessary recreations on every render
  // This prevents bubbles from being recreated when only UI state changes (like menu opens/closes)
  const bubbleChartData = useMemo(() => {
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
  }, [displayedCoins, coins]); // Only recreate when displayedCoins or coins actually change

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
      if (refreshForInterval) {
        // Progress line ko sync karein - refresh hone se pehle
        lastRefreshTimeRef.current = Date.now();
        setRefreshProgress(0);
        setIsProgressAnimating(true);
        
        refreshForInterval(currentInterval);
      }
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentInterval]); // Only refresh when interval changes, not when function reference changes

  // Define intervals
  const dayIntervals = ['1 Min', '5 Min', '15 Min', 'Hour'];
  const monthlyIntervals = ['Day', 'Week', 'Month', 'Year'];

  // Get current dropdown type
  const isDayInterval = dayIntervals.includes(currentInterval);
  const isMonthlyInterval = monthlyIntervals.includes(currentInterval);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dayIntervalAnchorRef.current && !dayIntervalAnchorRef.current.contains(event.target)) {
        setDayIntervalMenuOpen(false);
      }
      if (monthlyIntervalAnchorRef.current && !monthlyIntervalAnchorRef.current.contains(event.target)) {
        setMonthlyIntervalMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // compute max absolute percent change for percent-based sizing
  const maxAbsChange = coins && coins.length ? Math.max(...coins.map(c => Math.abs(c.price_change_percentage_24h || 0))) : 1;
  // Use a much smaller max radius and near-linear gamma for testing to avoid huge bubbles
  const radiusScale = useMemo(() => createRadiusScale(maxAbsChange, 8, 72, 1.05), [maxAbsChange]);

  const [indexManagerOpen, setIndexManagerOpen] = useState(false)
  const [snapshotPanelOpen, setSnapshotPanelOpen] = useState(false)
  const [marketSummaryOpen, setMarketSummaryOpen] = useState(false)

  const summaryInterval = currentInterval === 'Day' ? 'Day' : '5m';
  const { stats: marketStats, indices: indexSummaries, loading: marketLoading, error: marketError, refresh: refreshMarketStats } = useMarketStats({
    interval: summaryInterval,
    indexCode: selectedIndex || undefined,
    pollMs: ENABLE_LIVE_API ? 45000 : 0
  });


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

  // Use refs to store latest values so callbacks don't need to be recreated
  const refreshForIntervalRef = useRef(refreshForInterval);
  const currentIntervalRef = useRef(currentInterval);
  
  // Update refs when values change
  useEffect(() => {
    refreshForIntervalRef.current = refreshForInterval;
    currentIntervalRef.current = currentInterval;
  }, [refreshForInterval, currentInterval]);

  // Function to schedule next auto-refresh
  const scheduleNextRefresh = useCallback(() => {
    // Clear any existing timer
    if (autoRefreshTimerRef.current) {
      clearTimeout(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }
    
    // NOTE: Progress reset yahan nahi karte - progress reset interval change aur auto-refresh pe hoti hai
    
    // Set up auto-refresh after 30 seconds
    autoRefreshTimerRef.current = setTimeout(() => {
      if (refreshForIntervalRef.current) {
        // Progress line ko sync karein before refresh
        lastRefreshTimeRef.current = Date.now();
        setRefreshProgress(0);
        setIsProgressAnimating(true);
        
        refreshForIntervalRef.current(currentIntervalRef.current);
      }
      // Schedule the next refresh
      autoRefreshTimerRef.current = null;
      scheduleNextRefresh();
    }, 30000); // 30 seconds = 30000 milliseconds
  }, []); // No dependencies - uses refs instead

  // Function to handle manual refresh and set up auto-refresh cycle
  const handleRefresh = useCallback(() => {
    // Clear any existing timer
    if (autoRefreshTimerRef.current) {
      clearTimeout(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }
    
    // Reset progress
    setIsProgressAnimating(false); // Disable animation before reset
    lastRefreshTimeRef.current = Date.now();
    setRefreshProgress(0);
    // Re-enable animation after a brief moment
    setTimeout(() => setIsProgressAnimating(true), 50);
    
    // Perform the refresh
    if (refreshForIntervalRef.current) {
      refreshForIntervalRef.current(currentIntervalRef.current);
    }
    
    // Schedule the next auto-refresh
    scheduleNextRefresh();
  }, [scheduleNextRefresh]);

  // Progress tracking for refresh cycle
  useEffect(() => {
    if (!ENABLE_LIVE_API) return;
    
    // Update progress every 100ms for smooth animation
    refreshProgressTimerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastRefreshTimeRef.current;
      const progress = Math.min((elapsed / 30000) * 100, 100); // 30 seconds = 100%
      
      // Auto-reset when reaching 100% (refresh happens) - direct jump, no animation
      if (progress >= 100) {
        setIsProgressAnimating(false); // Disable animation before reset
        setRefreshProgress(0); // Direct reset without animation
        lastRefreshTimeRef.current = now;
        // Re-enable animation after a brief moment
        setTimeout(() => setIsProgressAnimating(true), 50);
      } else {
        setIsProgressAnimating(true); // Enable animation during progress
        setRefreshProgress(progress);
      }
    }, 100);
    
    return () => {
      if (refreshProgressTimerRef.current) {
        clearInterval(refreshProgressTimerRef.current);
      }
    };
  }, [ENABLE_LIVE_API]);

  // Auto-start refresh cycle when data loads
  useEffect(() => {
    // Start auto-refresh cycle after initial data load completes
    if (!loading && (coins.length > 0 || snapCount !== null)) {
      scheduleNextRefresh();
    }
    
    // Cleanup timer on unmount or when dependencies change
    return () => {
      if (autoRefreshTimerRef.current) {
        clearTimeout(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [loading, coins.length, snapCount, scheduleNextRefresh]);

  // NOTE: priceRange is discrete via PriceRange marks (1,10,100,500,1000+).
  // We intentionally don't override user selection on coins load so the
  // marks-based slider remains stable and predictable.

  // Global keyboard listener for opening search with typing
  useEffect(() => {
    function onGlobalKeyDown(e) {
      // Don't trigger if search is already open
      if (searchOpen) return;
      
      // Don't trigger if user is typing in an input, textarea, or contenteditable element
      const target = e.target;
      const isInputElement = target.tagName === 'INPUT' || 
                            target.tagName === 'TEXTAREA' || 
                            target.isContentEditable ||
                            target.closest('input, textarea, [contenteditable="true"]');
      
      if (isInputElement) return;
      
      // Don't trigger on modifier keys or special keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      
      // Don't trigger on function keys, arrows, etc.
      const specialKeys = [
        'Escape', 'Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete', 'Backspace',
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
      ];
      
      if (specialKeys.includes(e.key)) return;
      
      // If it's a printable character (length 1), open search with that character
      if (e.key.length === 1) {
        e.preventDefault();
        setInitialSearchQuery(e.key);
        setSearchOpen(true);
      }
    }
    
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', onGlobalKeyDown);
    };
  }, [searchOpen]);

  // Reset initial query when search closes
  useEffect(() => {
    if (!searchOpen) {
      // Small delay to ensure SearchPopover has closed
      setTimeout(() => setInitialSearchQuery(''), 100);
    }
  }, [searchOpen]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="logo-mark" aria-hidden="true"></span>
          <h1>PSX BUBBLES</h1>
        </div>

        <div className="header-actions">
          {/* Interval Dropdowns */}
          <div className="interval-dropdowns" style={{ display: 'flex', gap: '8px', marginRight: '12px' }}>
            {/* Day Intervals Dropdown */}
            <div ref={dayIntervalAnchorRef} style={{ position: 'relative' }}>
              <button
                className="interval-dropdown-btn"
                type="button"
                onClick={() => {
                  setDayIntervalMenuOpen(!dayIntervalMenuOpen);
                  setMonthlyIntervalMenuOpen(false);
                }}
                style={{
                  padding: '8px 16px',
                  background: isDayInterval ? 'rgba(61, 220, 132, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${isDayInterval ? 'rgba(61, 220, 132, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '8px',
                  color: '#eaeaea',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDayInterval ? 'rgba(61, 220, 132, 0.2)' : 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDayInterval ? 'rgba(61, 220, 132, 0.15)' : 'rgba(255, 255, 255, 0.05)';
                }}
              >
                <span>{isDayInterval ? currentInterval : dayIntervals[0]}</span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>
              {dayIntervalMenuOpen && (
                <div
                  className="interval-dropdown-menu"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    background: '#1a2332',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '4px',
                    minWidth: '120px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                    zIndex: 1000
                  }}
                >
                  {dayIntervals.map((interval) => {
                    const pct = avgFavPctForInterval(interval);
                    const bg = pctToColor(pct);
                    return (
                      <button
                        key={interval}
                        type="button"
                        onClick={() => {
                          setCurrentInterval(interval);
                          setDayIntervalMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: interval === currentInterval ? 'rgba(61, 220, 132, 0.2)' : 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          color: interval === currentInterval ? '#7ff0a0' : '#eaeaea',
                          cursor: 'pointer',
                          fontSize: '14px',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (interval !== currentInterval) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (interval !== currentInterval) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: bg, flexShrink: 0 }} />
                        <span>{interval}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Monthly Intervals Dropdown */}
            <div ref={monthlyIntervalAnchorRef} style={{ position: 'relative' }}>
              <button
                className="interval-dropdown-btn"
                type="button"
                onClick={() => {
                  setMonthlyIntervalMenuOpen(!monthlyIntervalMenuOpen);
                  setDayIntervalMenuOpen(false);
                }}
                style={{
                  padding: '8px 16px',
                  background: isMonthlyInterval ? 'rgba(61, 220, 132, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${isMonthlyInterval ? 'rgba(61, 220, 132, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '8px',
                  color: '#eaeaea',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isMonthlyInterval ? 'rgba(61, 220, 132, 0.2)' : 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isMonthlyInterval ? 'rgba(61, 220, 132, 0.15)' : 'rgba(255, 255, 255, 0.05)';
                }}
              >
                <span>{isMonthlyInterval ? currentInterval : monthlyIntervals[0]}</span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>
              {monthlyIntervalMenuOpen && (
                <div
                  className="interval-dropdown-menu"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    background: '#1a2332',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '4px',
                    minWidth: '120px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                    zIndex: 1000
                  }}
                >
                  {monthlyIntervals.map((interval) => {
                    const pct = avgFavPctForInterval(interval);
                    const bg = pctToColor(pct);
                    return (
                      <button
                        key={interval}
                        type="button"
                        onClick={() => {
                          setCurrentInterval(interval);
                          setMonthlyIntervalMenuOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: interval === currentInterval ? 'rgba(61, 220, 132, 0.2)' : 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          color: interval === currentInterval ? '#7ff0a0' : '#eaeaea',
                          cursor: 'pointer',
                          fontSize: '14px',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (interval !== currentInterval) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (interval !== currentInterval) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: bg, flexShrink: 0 }} />
                        <span>{interval}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Header Pages Dropdown - Visible in Landscape */}
          <div className="header-pages-dropdown">
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
                <div className="header-pages-button-wrapper">
                  <button
                    className="header-pages-button"
                    onClick={() => setFavoritesOpen((s) => !s)}
                  >
                    ★ {floatingLabel} ▾
                  </button>
                  
                  {/* Menu content - Column layout like screenshot */}
                  {favoritesOpen && (
                    <div className="header-favorites-menu header-favorites-menu-columns">
                      {/* Pages Column */}
                      <div className="menu-column">
                        <div className="menu-title">Pages <span className="interval">{currentInterval}</span></div>
                        <div className="menu-list">
                          <button className={`menu-row ${(pageIndex === null && !selectedIndex) ? 'active' : ''}`} onClick={() => { setSelectedIndex(null); setPageIndex(null); }}>
                            <input type="radio" readOnly checked={(pageIndex === null && !selectedIndex)} />
                            <span className="menu-label">All</span>
                            <span className="menu-pct"></span>
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
                              const bgColor = avg > 0 ? 'rgba(61,220,132,0.15)' : avg < 0 ? 'rgba(255,155,155,0.15)' : 'transparent';
                              return (
                                <button 
                                  key={i} 
                                  className={`menu-row ${(pageIndex === i && !selectedIndex) ? 'active' : ''}`} 
                                  onClick={() => { setSelectedIndex(null); setPageIndex(i); }}
                                  style={{ background: bgColor }}
                                >
                                  <input type="radio" readOnly checked={(pageIndex === i && !selectedIndex)} />
                                  <span className="menu-label">{`${start} - ${end}`}</span>
                                  <span className={`menu-pct ${avg >= 0 ? 'pos' : 'neg'}`}>{`${sign}${avg.toFixed(2)}%`}</span>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                      
                      {/* Lists Column */}
                      <div className="menu-column">
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
                              const bgColor = avg > 0 ? 'rgba(61,220,132,0.15)' : avg < 0 ? 'rgba(255,155,155,0.15)' : 'transparent';
                              return (
                                <div key={ld.id} className="menu-row" style={{ background: bgColor }}>
                                  <input type="radio" readOnly checked={false} />
                                  <span className="menu-label">{ld.label}</span>
                                  <span className={`menu-pct ${avg > 0 ? 'pos' : 'neg'}`}>{avg == null ? '-' : `${sign}${avg.toFixed(2)}%`}</span>
                                </div>
                              );
                            })
                          })()}
                        </div>
                      </div>
                      
                      {/* Indices Column */}
                      <div className="menu-column">
                        <div className="menu-title">Indices <span className="interval">{currentInterval}</span></div>
                        <div className="menu-list">
                          {(() => {
                            const indices = ['KSE 100', 'KSE 30', 'ALLSHR', 'KMI 30', 'KMIALLSHR'];
                            return indices.map((ix) => {
                              const membersIds = indexMap && indexMap[ix] ? (indexMap[ix] || []) : [];
                              const membersSet = new Set(membersIds.map(s => ('' + s).toLowerCase()));
                              const members = membersIds.length ? coins.filter((c) => membersSet.has((c.symbol || c.id || '').toLowerCase())) : [];
                              const vals = members.map((c) => approxPctForInterval(currentInterval, c.price_change_percentage_24h || 0));
                              const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
                              const sign = avg >= 0 ? '+' : '';
                              const bgColor = avg > 0 ? 'rgba(61,220,132,0.15)' : avg < 0 ? 'rgba(255,155,155,0.15)' : 'transparent';
                              return (
                                <div key={ix} className={`menu-row ${selectedIndex === ix ? 'active' : ''}`} style={{ background: bgColor }}>
                                  <button onClick={() => { setSelectedIndex(selectedIndex === ix ? null : ix); setPageIndex(null); }}>
                                    <input type="radio" readOnly checked={selectedIndex === ix} />
                                    <span className="menu-label">{ix}</span>
                                    <span className={`menu-pct ${avg > 0 ? 'pos' : 'neg'}`}>{avg == null ? '-' : `${sign}${avg.toFixed(2)}%`}</span>
                                  </button>
                                  <button
                                    title={`Open Index Manager for ${ix}`}
                                    onClick={(e) => { e.stopPropagation(); setIndexManagerOpen(true); setSelectedIndex(ix); }}
                                    className="index-edit-btn"
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
              );
            })()}
          </div>

          <button
            className="search-icon"
            title="Search (or start typing)"
            aria-label="Open search"
            onClick={(e) => { setSearchAnchor(e.currentTarget.getBoundingClientRect()); setSearchOpen(true); }}
          >
            🔍
          </button>

          {/* Settings Button - Opens PillMenu */}
          <button
            className="search-icon settings-button"
            title="Settings"
            aria-label="Open settings"
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setPillAnchor({
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
              });
              setPillMenuOpen(true);
              // Close interval dropdowns if open
              setDayIntervalMenuOpen(false);
              setMonthlyIntervalMenuOpen(false);
            }}
            style={{
              position: 'relative'
            }}
          >
            ⚙️
          </button>

          <button
            className="search-icon"
            title="Refresh data"
            aria-label="Refresh data"
            onClick={handleRefresh}
          >
            ⟳
          </button>
          <div style={{ marginLeft: 12, color: '#9fb8b0', fontSize: 12 }}>
            {ENABLE_LIVE_API
              ? (loading
                ? 'Refreshing…'
                : (latestTimestamp
                  ? `Live as of ${new Date(latestTimestamp).toLocaleTimeString()}`
                  : 'Live data ready'))
              : (loading ? 'Loading snapshots...' : (snapCount != null ? `${snapCount} snapshots` : ''))}
            {error ? ` — ${error}` : ''}
            {!ENABLE_LIVE_API && (
              <>
                <button style={{ marginLeft: 8 }} onClick={() => importSnapshotsIfNeeded && importSnapshotsIfNeeded(true)}>Re-import</button>
                <button style={{ marginLeft: 8 }} onClick={() => setSnapshotPanelOpen(true)}>Snapshots ▾</button>
              </>
            )}
            {ENABLE_LIVE_API && (
              <>
                <span style={{ marginLeft: 8 }}>
                  {snapCount != null ? `${snapCount} symbols` : ''}
                </span>
              </>
            )}
          </div>
          {/* Demo-only: removed Live, Debug, Backfill and Fetch controls */}
        </div>
      </header>
      {/* Full Width Progress Bar - Header ke down */}
      {ENABLE_LIVE_API && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '3px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${refreshProgress}%`,
              backgroundColor: 'rgba(61, 220, 132, 0.8)',
              transition: isProgressAnimating ? 'width 0.1s linear' : 'none',
              boxShadow: '0 0 8px rgba(61, 220, 132, 0.5)'
            }}
          />
        </div>
      )}

      {/* Market Summary Panel */}
      {ENABLE_LIVE_API && marketSummaryOpen && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="market-summary-backdrop"
            onClick={() => setMarketSummaryOpen(false)}
          />
          
          {/* Panel - Same layout as before, but slides in from right */}
          <div 
            className="market-summary-panel market-summary-panel-slide" 
            id="market-summary-panel"
          >
            {marketError && (
              <div className="market-summary-error">
                Market stats error: {marketError}
                <button type="button" onClick={() => refreshMarketStats()} className="market-summary-retry">Retry</button>
              </div>
            )}
            {!marketError && marketLoading && (
              <div className="market-summary-loading">Loading market data…</div>
            )}
            {!marketError && !marketLoading && !marketStats && (
              <div className="market-summary-empty">No market data available.</div>
            )}
            {marketStats && (
              <MarketSummary
                stats={marketStats}
                indices={indexSummaries}
                loading={marketLoading}
                onRetry={() => refreshMarketStats()}
              />
            )}
          </div>
        </>
      )}
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
          onOpenSymbols={() => setSymbolsPanelOpen(true)}
        />
      )}

      {searchOpen && (
        <SearchPopover
          coins={(() => {
            const m = getAllMetadata();
            const visible = (coins || []).filter((c) => !(m[c.symbol] && m[c.symbol].hidden));
            // Merge metadata (image, displayName, shortName) into each coin so SearchPopover can render logos
            return visible.map((c) => {
              try {
                const key = (c.symbol || c.id || '').toString();
                const meta = m[key] || {};
                return Object.assign({}, c, {
                  image: meta.image || c.image,
                  displayName: meta.displayName || c.displayName,
                  shortName: meta.shortName || c.shortName
                });
              } catch (e) {
                return c;
              }
            });
          })()}
          anchorRect={searchAnchor}
          initialQuery={initialSearchQuery}
          onSelect={(c) => setSelectedCoin(c)}
          onClose={() => setSearchOpen(false)}
        />
      )}

      <main className="main">
        <section className="viz" style={{ position: 'relative' }}>
          {/* Market Summary Button - Top Right */}
          {ENABLE_LIVE_API && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                zIndex: 1001,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <button
                onClick={() => setMarketSummaryOpen((open) => !open)}
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(61, 220, 132, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(61, 220, 132, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                <span>📊</span>
                <span>Market Summary</span>
                <span
                  className={[
                    'market-summary-status',
                    marketError ? 'error' : '',
                    !marketError && marketLoading ? 'loading' : '',
                    !marketError && !marketLoading && marketStats ? 'ok' : '',
                    !marketError && !marketLoading && !marketStats ? 'empty' : ''
                  ].filter(Boolean).join(' ')}
                  style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: marketError 
                      ? 'rgba(255,155,155,0.14)' 
                      : (!marketError && marketLoading 
                        ? 'rgba(245,214,122,0.2)' 
                        : (!marketError && !marketLoading && marketStats 
                          ? 'rgba(61,220,132,0.12)' 
                          : 'rgba(255,255,255,0.08)')),
                    color: marketError 
                      ? '#ff9b9b' 
                      : (!marketError && marketLoading 
                        ? '#f5d67a' 
                        : (!marketError && !marketLoading && marketStats 
                          ? '#7fe6ae' 
                          : '#9fb8b0'))
                  }}
                >
                  {marketError ? 'Error' : (marketLoading ? 'Loading…' : (marketStats ? 'Updated' : 'No data'))}
                </span>
              </button>
            </div>
          )}
          
          {(!coins || coins.length === 0) ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#9fb8b0' }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No chart data available</div>
              <div style={{ marginBottom: 8 }}>Symbols available: {snapCount != null ? snapCount : 'unknown'}</div>
              {!ENABLE_LIVE_API && (
                <>
                  <div style={{ marginBottom: 12 }}>If this stays blank: open DevTools → Application → IndexedDB → `psx-snapshots-db` and check `snapshots` store.</div>
                  <div>
                    <button onClick={() => importSnapshotsIfNeeded && importSnapshotsIfNeeded(true)} style={{ marginRight: 8 }}>Re-import snapshots</button>
                    <button onClick={() => refreshForInterval && refreshForInterval(currentInterval)}>Refresh interval</button>
                  </div>
                </>
              )}
              {ENABLE_LIVE_API && (
                <div style={{ marginBottom: 12 }}>Live feed connected. Try refreshing the interval or toggling auto-refresh.</div>
              )}
            </div>
          ) : (
            <BubbleChart
              ref={chartRef}
              data={bubbleChartData}
              selectedIndex={selectedIndex}
              className="bubble-chart"
              single={false}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%' }}>
          {/* PriceRange hidden but code kept for future use */}
          <div style={{ flex: 1, display: 'none' }}>
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
            <div className="floating-card" onClick={() => setFavoritesOpen((s) => !s)} style={{ cursor: 'pointer' }}>
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
                <button className={`menu-row ${(pageIndex === null && !selectedIndex) ? 'active' : ''}`} onClick={() => { setSelectedIndex(null); setPageIndex(null); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', textAlign: 'left', width: '100%', padding: '6px 8px' }}>
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
                              const bgColor = avg > 0 ? 'rgba(61,220,132,0.15)' : avg < 0 ? 'rgba(255,155,155,0.15)' : 'transparent';
                              return (
                                <button key={i} className={`menu-row ${(pageIndex === i && !selectedIndex) ? 'active' : ''}`} onClick={() => { setSelectedIndex(null); setPageIndex(i); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: bgColor, border: 'none', textAlign: 'left', flex: '1 1 auto', padding: '6px 8px' }}>
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
                    const bgColor = avg > 0 ? 'rgba(61,220,132,0.15)' : avg < 0 ? 'rgba(255,155,155,0.15)' : 'transparent';
                    return (
                      <div key={ld.id} className={`menu-row`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: bgColor }}>
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
                  const indices = ['KSE 100', 'KSE 30', 'ALLSHR', 'KMI 30', 'KMIALLSHR'];
                  return indices.map((ix) => {
                    const membersIds = indexMap && indexMap[ix] ? (indexMap[ix] || []) : [];
                    // try to match by symbol or id (case-insensitive)
                    const membersSet = new Set(membersIds.map(s => ('' + s).toLowerCase()));
                    const members = membersIds.length ? coins.filter((c) => membersSet.has((c.symbol || c.id || '').toLowerCase())) : [];
                    const vals = members.map((c) => approxPctForInterval(currentInterval, c.price_change_percentage_24h || 0));
                    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
                    const sign = avg >= 0 ? '+' : '';
                    const bgColor = avg > 0 ? 'rgba(61,220,132,0.15)' : avg < 0 ? 'rgba(255,155,155,0.15)' : 'transparent';
                    return (
                      <div key={ix} className={`menu-row ${selectedIndex === ix ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: bgColor }}>
                        <button onClick={() => { setSelectedIndex(selectedIndex === ix ? null : ix); setPageIndex(null); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', textAlign: 'left', flex: '1 1 auto', padding: '6px 8px' }}>
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
          onPublishSuccess={handleIndexPublish}
        />
      )}
      {snapshotPanelOpen && (
        <SnapshotPanel open={snapshotPanelOpen} onClose={() => setSnapshotPanelOpen(false)} onImported={() => { importSnapshotsIfNeeded && importSnapshotsIfNeeded(false); refreshForInterval && refreshForInterval(currentInterval); }} />
      )}
      {!ENABLE_LIVE_API && (
        <CsvPanel refreshCallback={refreshForInterval} currentInterval={currentInterval} />
      )}

      {symbolsPanelOpen && (
        <SymbolsPanel
          open={symbolsPanelOpen}
          onClose={() => setSymbolsPanelOpen(false)}
          symbols={coins && coins.length ? coins : []}
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

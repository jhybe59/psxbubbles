import React, { useEffect, useState, useRef } from 'react';
import EmbeddedChart from './EmbeddedChart';
import { LIVE_API_BASE_URL, LIVE_API_KEY, ENABLE_LIVE_API } from '../config';
import storage from '../lib/storage';
import { buildCandlesFromSnapshots } from '../lib/chartUtils';
import { getCandleType } from '../lib/indicators';

// Lazy load the fullscreen chart component
const AdvancedChart = React.lazy(() => import('./AdvancedChart'));

export default function QuickChart({ symbol, interval, x, y, onClose, currentPrice }) {
    const [series, setSeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef(null);
    const chartWrapperRef = useRef(null); // Ref for the chart wrapper to measure height
    const [chartHeight, setChartHeight] = useState(null); // Dynamic height
    const [showAdvancedChart, setShowAdvancedChart] = useState(false); // For fullscreen modal
    // Interval state for AdvancedChart (separate name to avoid conflict with mapInterval result)
    const [advChartInterval, setAdvChartInterval] = useState(() => mapInterval(interval));
    // Chart type state
    const [chartType, setChartType] = useState('Candles');
    const [candleType, setCandleType] = useState('Candles');

    // Map bubble interval to chart interval (defined early, no conflict now)
    function mapInterval(int) {
        const mapping = {
            '1 Min': '1m', '5 Min': '5m', '15 Min': '15m', 'Hour': '1h',
            'Day': 'Day', 'Week': 'Week', 'Month': 'Month', 'Year': 'Year',
            '10 Ticks': '10T', '20 Ticks': '20T', '50 Ticks': '50T', '100 Ticks': '100T', '500 Ticks': '500T', '1000 Ticks': '1000T'
        };
        return mapping[int] || '1h';
    }

    const chartInterval = mapInterval(interval);

    // ... (fetchData useEffect code)

    // REAL-TIME UPDATE
    useEffect(() => {
        if (series.length > 0 && currentPrice) {
            const price = Number(currentPrice);
            if (!Number.isFinite(price)) return;

            setSeries(prev => {
                const newSeries = [...prev];
                const lastIdx = newSeries.length - 1;
                const lastCandle = { ...newSeries[lastIdx] };

                // Update Close
                lastCandle.close = price;
                // Update High/Low
                if (price > lastCandle.high) lastCandle.high = price;
                if (price < lastCandle.low) lastCandle.low = price;

                newSeries[lastIdx] = lastCandle;
                return newSeries;
            });
        }
    }, [currentPrice]); // Updates whenever currentPrice prop changes provided by parent

    // (mapInterval and chartInterval now defined above)

    useEffect(() => {
        let mounted = true;
        let intervalId = null;

        async function fetchData(isPolling = false) {
            if (!symbol) return;
            if (!isPolling) setLoading(true); // Don't show loading spinner on poll
            try {
                // Ticks Logic
                if (chartInterval.includes('T')) {
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const base = LIVE_API_BASE_URL.startsWith('http') ? LIVE_API_BASE_URL : `${origin}${LIVE_API_BASE_URL.startsWith('/') ? '' : '/'}${LIVE_API_BASE_URL}`;
                    const url = new URL('tick-candles', base.endsWith('/') ? base : `${base}/`);
                    url.searchParams.set('symbol', symbol);
                    url.searchParams.set('interval', chartInterval);
                    url.searchParams.set('limit', '100');

                    const headers = { 'Content-Type': 'application/json' };
                    if (LIVE_API_KEY) headers['x-api-key'] = LIVE_API_KEY;

                    const res = await fetch(url.toString(), { headers });
                    if (!res.ok) {
                        console.warn('[QuickChart] Tick API returned non-OK status:', res.status);
                        return; // Keep existing data
                    }
                    const json = await res.json();
                    if (mounted && json.data && json.data.length > 0) {
                        setSeries(json.data.map(d => ({
                            ts: new Date(d.ts).getTime(),
                            open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume
                        })));
                    } else if (isPolling) {
                        console.log('[QuickChart] Poll returned empty, keeping existing chart data');
                        // Do nothing - preserve existing series
                    }
                }
                // Time-based Logic
                else {
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const base = LIVE_API_BASE_URL.startsWith('http') ? LIVE_API_BASE_URL : `${origin}${LIVE_API_BASE_URL.startsWith('/') ? '' : '/'}${LIVE_API_BASE_URL}`;
                    const url = new URL('candles', base.endsWith('/') ? base : `${base}/`);
                    url.searchParams.set('symbol', symbol);
                    url.searchParams.set('interval', chartInterval);
                    url.searchParams.set('limit', '200');

                    const headers = { 'Content-Type': 'application/json' };
                    if (LIVE_API_KEY) headers['x-api-key'] = LIVE_API_KEY;

                    const res = await fetch(url.toString(), { headers });
                    if (!res.ok) {
                        console.warn('[QuickChart] Candles API returned non-OK status:', res.status);
                        return; // Keep existing data
                    }
                    const json = await res.json();
                    if (mounted && json.data && json.data.length > 0) {
                        setSeries(json.data.map(d => ({
                            ts: new Date(d.ts).getTime(),
                            open: Number(d.open), high: Number(d.high), low: Number(d.low), close: Number(d.close), volume: Number(d.volume)
                        })).sort((a, b) => a.ts - b.ts));
                    } else if (isPolling) {
                        console.log('[QuickChart] Poll returned empty, keeping existing chart data');
                        // Do nothing - preserve existing series
                    }
                }
            } catch (err) {
                console.error("[QuickChart] fetch error:", err);
                // On error, preserve existing data - don't clear
            } finally {
                if (mounted && !isPolling) setLoading(false);
            }
        }

        fetchData(false);

        // Poll every 10 seconds
        if (ENABLE_LIVE_API) {
            intervalId = setInterval(() => {
                fetchData(true);
            }, 10000); // 10s poll for snappier updates
        }

        return () => {
            mounted = false;
            if (intervalId) clearInterval(intervalId);
        };
    }, [symbol, chartInterval]);

    // Click outside to close
    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // State for dimension
    const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
    // no internal fullscreen state anymore

    // Adjust position to stay on screen (initial only, or clamped)
    // We'll trust parent props x,y as starting point but let user resize
    // We are NOT doing drag-move logic for the window itself right now (unless requested, plan said resize)
    // But to resize "from left" or "from top", we effectively need to change x/y too?
    // User said "jidr se marzi user chota bada kar le" (resize from anywhere).
    // If we resize from LEFT, we must change Left position and Width.
    // IMPT: The component receives `x` and `y` from props. If we want to move it, we might need internal state for position too.

    const [position, setPosition] = useState({ x: x, y: y });

    // Sync prop x/y to state only on mount or if we want to respect prop updates (usually only on open)
    useEffect(() => {
        setPosition({ x, y });
    }, [x, y]);

    // Ensure it doesn't go off screen initially
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setPosition(prev => {
                let newX = prev.x;
                let newY = prev.y;
                if (newX + dimensions.width > window.innerWidth) newX = Math.max(0, window.innerWidth - dimensions.width - 10);
                if (newY + dimensions.height > window.innerHeight) newY = Math.max(0, window.innerHeight - dimensions.height - 10);
                return { x: newX, y: newY };
            });
        }
    }, [dimensions.width, dimensions.height]); // only on dimension change/init


    // Resizing Logic
    const [resizing, setResizing] = useState(null); // { dir: 'e'|'s'|'se'|'w'|'n'..., startX, startY, startW, startH, startXPos, startYPos }

    const startResize = (e, dir) => {
        e.preventDefault();
        e.stopPropagation();
        setResizing({
            dir,
            startX: e.clientX,
            startY: e.clientY,
            startW: dimensions.width,
            startH: dimensions.height,
            startXPos: position.x,
            startYPos: position.y
        });
    };

    useEffect(() => {
        if (!resizing) return;

        const handleMouseMove = (e) => {
            const dx = e.clientX - resizing.startX;
            const dy = e.clientY - resizing.startY;

            let newW = resizing.startW;
            let newH = resizing.startH;
            let newX = resizing.startXPos;
            let newY = resizing.startYPos;

            // Horizontal
            if (resizing.dir.includes('e')) {
                newW = Math.max(300, resizing.startW + dx);
            } else if (resizing.dir.includes('w')) {
                newW = Math.max(300, resizing.startW - dx);
                newX = resizing.startXPos + dx;
                // Prevent shrinking below min width causing jump
                if (newW === 300) newX = resizing.startXPos + (resizing.startW - 300);
            }

            // Vertical
            if (resizing.dir.includes('s')) {
                newH = Math.max(200, resizing.startH + dy);
            } else if (resizing.dir.includes('n')) {
                newH = Math.max(200, resizing.startH - dy);
                newY = resizing.startYPos + dy;
                if (newH === 200) newY = resizing.startYPos + (resizing.startH - 200);
            }

            setDimensions({ width: newW, height: newH });
            if (resizing.dir.includes('w') || resizing.dir.includes('n')) {
                setPosition({ x: newX, y: newY });
            }
        };

        const handleMouseUp = () => {
            setResizing(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizing]);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                width: dimensions.width,
                height: dimensions.height,
                zIndex: 10001,
                background: '#131722',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
                border: '1px solid #334155',
                overflow: 'visible', // Visible for resize handles outside? Or hidden for content? 
                // We need visible for handles if they are outside, but let's put handles INSIDE or overlapping border
                display: 'flex',
                flexDirection: 'column',
            }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div style={{
                padding: '4px 8px',
                background: '#1e293b',
                borderBottom: '1px solid #334155',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                color: '#94a3b8',
                cursor: 'default'
            }}>
                <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{symbol} • {chartInterval}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            // Use original interval prop (e.g. "50 Ticks") not chartInterval (e.g. "50T")
                            // StandaloneChart needs the full format to detect tick intervals
                            const url = `/chart/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&type=Candles&candleType=Candles`;
                            window.open(url, '_blank');
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '2px'
                        }}
                        title="Open Advanced Chart (Full Screen)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
                    </button>
                    <span style={{ fontSize: '10px' }}>Right-Click Chart</span>
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                        Loading...
                    </div>
                ) : (
                    <EmbeddedChart
                        data={series}
                        symbol={symbol}
                        height={dimensions.height - 28} // Subtract header height
                        candleType={getCandleType()}
                    // Re-use same indicators from default profile
                    />
                )}
            </div>

            {/* Resize Handles */}
            {/* Right */}
            <div onMouseDown={(e) => startResize(e, 'e')} style={{ position: 'absolute', top: 0, right: 0, width: '4px', height: '100%', cursor: 'e-resize', zIndex: 20 }} />
            {/* Bottom */}
            <div onMouseDown={(e) => startResize(e, 's')} style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '4px', cursor: 's-resize', zIndex: 20 }} />
            {/* Bottom-Right */}
            <div onMouseDown={(e) => startResize(e, 'se')} style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', cursor: 'se-resize', zIndex: 21, background: 'linear-gradient(135deg, transparent 50%, #475569 50%)', borderBottomRightRadius: '7px' }} />
            {/* Left */}
            <div onMouseDown={(e) => startResize(e, 'w')} style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', cursor: 'w-resize', zIndex: 20 }} />
            {/* Top */}
            <div onMouseDown={(e) => startResize(e, 'n')} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', cursor: 'n-resize', zIndex: 20 }} />
            {/* Bottom-Left */}
            <div onMouseDown={(e) => startResize(e, 'sw')} style={{ position: 'absolute', bottom: 0, left: 0, width: '12px', height: '12px', cursor: 'sw-resize', zIndex: 21 }} />
            {/* Top-Right */}
            <div onMouseDown={(e) => startResize(e, 'ne')} style={{ position: 'absolute', top: 0, right: 0, width: '12px', height: '12px', cursor: 'ne-resize', zIndex: 21 }} />
            {/* Top-Left */}
            <div onMouseDown={(e) => startResize(e, 'nw')} style={{ position: 'absolute', top: 0, left: 0, width: '12px', height: '12px', cursor: 'nw-resize', zIndex: 21 }} />

            {/* Advanced Chart Overlay */}
            {showAdvancedChart && (
                <React.Suspense fallback={<div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Loading Chart...</div>}>
                    <AdvancedChart
                        data={series}
                        symbol={symbol}
                        timeframe={advChartInterval}
                        onTimeframeChange={setAdvChartInterval}
                        chartType={chartType}
                        setChartType={setChartType}
                        candleType={candleType}
                        setCandleType={setCandleType}
                        onClose={() => setShowAdvancedChart(false)}
                    />
                </React.Suspense>
            )}
        </div>
    );
}

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, AreaSeries, LineSeries } from 'lightweight-charts';
import DaySeparatorPlugin from '../lib/chart/DaySeparatorPlugin';
import { getIndicator, getActiveIndicators, addIndicator, removeIndicator, toggleIndicatorVisibility, updateIndicator } from '../lib/indicators';
import { toHeikinAshi } from '../lib/heikinAshi';
import { LIVE_API_BASE_URL, LIVE_API_KEY } from '../config';
import SearchPopover from './SearchPopover';

const THEME_DARK = {
    layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#D1D4DC',
    },
    grid: {
        vertLines: { color: '#363a45', style: 1 },
        horzLines: { color: '#363a45', style: 1 },
    },
    crosshair: { mode: 0 },
    rightPriceScale: { borderColor: '#363a45' },
    timeScale: {
        borderColor: '#363a45',
        timeVisible: true,
        secondsVisible: false,
    },
};

const CANDLE_INTERVALS = ['10 Ticks', '100 Ticks', '500 Ticks', '1000 Ticks', '1m', '5m', '15m', '1h', '4h', 'Day', 'Week', 'Month', 'Year'];

/**
 * ChartPanel - A single chart panel for split-screen layout
 * Each panel can have its own symbol and interval
 */
export default function ChartPanel({
    id,
    symbol,
    interval = '15m',
    candleType = 'Candles',
    isActive = false,
    onActivate,
    onSymbolChange,
    onIntervalChange,
    onCandleTypeChange,
    syncSettings = null, // { interval, candleType } when sync is enabled
    inheritedIndicators = [], // Indicators inherited from single mode
    chartSettings = {}, // Chart settings (Day Separator, etc.)
    showHeader = true,
    style = {}
}) {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef(null);
    const volumeSeriesRef = useRef(null);
    const indicatorSeriesRef = useRef({});

    const [series, setSeries] = useState([]);
    const [showIntervalMenu, setShowIntervalMenu] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState(''); // For keyboard search
    const [availableCoins, setAvailableCoins] = useState([]);
    const [legend, setLegend] = useState(null);
    const [dayOHLC, setDayOHLC] = useState(null); // Day-based OHLC for tooltip
    // Initialize with inherited indicators if provided
    const [activeIndicators, setActiveIndicators] = useState(() =>
        inheritedIndicators.length > 0 ? [...inheritedIndicators] : []
    );

    // Use synced settings if provided, otherwise use local
    const effectiveInterval = syncSettings?.interval || interval;
    const effectiveCandleType = syncSettings?.candleType || candleType;

    // Fetch available symbols for search
    useEffect(() => {
        async function fetchSymbols() {
            try {
                const origin = window.location.origin;
                const base = LIVE_API_BASE_URL.startsWith('http')
                    ? LIVE_API_BASE_URL
                    : `${origin}${LIVE_API_BASE_URL.startsWith('/') ? '' : '/'}${LIVE_API_BASE_URL}`;
                const url = new URL('bubbles', base.endsWith('/') ? base : `${base}/`);
                url.searchParams.set('interval', 'Day');

                const headers = { 'Content-Type': 'application/json' };
                if (LIVE_API_KEY) headers['x-api-key'] = LIVE_API_KEY;

                const res = await fetch(url.toString(), { headers });
                if (res.ok) {
                    const json = await res.json();
                    const coins = (json.data || json.symbols || []).map(d => ({
                        symbol: d.symbol,
                        name: d.name || d.symbol,
                        price: d.close || d.price
                    }));
                    setAvailableCoins(coins);
                }
            } catch (err) {
                console.warn('ChartPanel: Failed to fetch symbols:', err);
            }
        }
        fetchSymbols();
    }, []);

    // Fetch Day-based OHLC for tooltip (separate from interval candles)
    useEffect(() => {
        if (!symbol) return;

        let mounted = true;
        async function fetchDayOHLC() {
            try {
                const origin = window.location.origin;
                const base = LIVE_API_BASE_URL.startsWith('http')
                    ? LIVE_API_BASE_URL
                    : `${origin}${LIVE_API_BASE_URL.startsWith('/') ? '' : '/'}${LIVE_API_BASE_URL}`;

                const url = new URL('candles', base.endsWith('/') ? base : `${base}/`);
                url.searchParams.set('interval', 'Day');
                url.searchParams.set('symbol', symbol);
                url.searchParams.set('limit', '1'); // Just today's data

                const headers = { 'Content-Type': 'application/json' };
                if (LIVE_API_KEY) headers['x-api-key'] = LIVE_API_KEY;

                const res = await fetch(url.toString(), { headers });
                if (res.ok && mounted) {
                    const json = await res.json();
                    if (json.data && json.data.length > 0) {
                        const d = json.data[json.data.length - 1]; // Latest day
                        setDayOHLC({
                            open: Number(d.open),
                            high: Number(d.high),
                            low: Number(d.low),
                            close: Number(d.close),
                            volume: Number(d.volume) || 0
                        });
                    }
                }
            } catch (err) {
                console.warn('ChartPanel: Failed to fetch day OHLC:', err);
            }
        }

        fetchDayOHLC();
        const pollInterval = setInterval(fetchDayOHLC, 10000); // Poll every 10s

        return () => {
            mounted = false;
            clearInterval(pollInterval);
        };
    }, [symbol]);

    // Fetch chart data
    useEffect(() => {
        if (!symbol) return;

        let mounted = true;
        async function fetchData(isPolling = false) {
            try {
                const isTick = effectiveInterval.includes('Tick');
                const origin = window.location.origin;
                const base = LIVE_API_BASE_URL.startsWith('http')
                    ? LIVE_API_BASE_URL
                    : `${origin}${LIVE_API_BASE_URL.startsWith('/') ? '' : '/'}${LIVE_API_BASE_URL}`;

                let url;
                if (isTick) {
                    url = new URL('tick-candles', base.endsWith('/') ? base : `${base}/`);
                    const intervalCode = effectiveInterval.replace(' Ticks', 'T').replace(' ', '');
                    url.searchParams.set('interval', intervalCode);
                    url.searchParams.set('limit', '100');
                } else {
                    url = new URL('candles', base.endsWith('/') ? base : `${base}/`);
                    url.searchParams.set('interval', effectiveInterval);
                    url.searchParams.set('limit', '500');
                }

                url.searchParams.set('symbol', symbol);

                const headers = { 'Content-Type': 'application/json' };
                if (LIVE_API_KEY) headers['x-api-key'] = LIVE_API_KEY;

                const res = await fetch(url.toString(), { headers });
                if (res.ok && mounted) {
                    const json = await res.json();
                    if (json.data && json.data.length > 0) {
                        let s = json.data.map(d => ({
                            ts: new Date(d.ts).getTime(),
                            open: Number(d.open),
                            high: Number(d.high),
                            low: Number(d.low),
                            close: Number(d.close),
                            volume: Number(d.volume) || 0
                        }));
                        s.sort((a, b) => a.ts - b.ts);
                        setSeries(s);
                    } else if (isPolling) {
                        // Polling returned empty, preserve existing chart data
                        console.log('[ChartPanel] Poll returned empty, preserving existing chart');
                    }
                }
            } catch (err) {
                console.error('ChartPanel: Fetch error:', err);
                // On polling error, preserve existing data (don't clear)
            }
        }

        fetchData(false);  // Initial load
        const pollInterval = setInterval(() => fetchData(true), 10000);  // Polling

        return () => {
            mounted = false;
            clearInterval(pollInterval);
        };
    }, [symbol, effectiveInterval]);

    // Initialize chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            ...THEME_DARK,
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
        });
        chartRef.current = chart;

        // Main series (candlestick)
        const mainSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#089981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#089981',
            wickDownColor: '#ef4444',
        });
        seriesRef.current = mainSeries;

        // Day Separator Plugin
        const daySeparator = new DaySeparatorPlugin();
        if (chartSettings && chartSettings.sessionBreaks) {
            daySeparator.applyOptions(chartSettings.sessionBreaks);
        }
        mainSeries.attachPrimitive(daySeparator);
        chartRef.current.daySeparator = daySeparator; // Save ref for updates

        // Volume series
        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });
        volumeSeriesRef.current = volumeSeries;

        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
            visible: false,
        });

        chart.priceScale('right').applyOptions({
            scaleMargins: { top: 0.1, bottom: 0.1 },
        });

        // Crosshair move handler
        chart.subscribeCrosshairMove((param) => {
            if (!param.point || !param.time) {
                setLegend(null);
                return;
            }
            const priceData = param.seriesData.get(mainSeries);
            const volumeData = param.seriesData.get(volumeSeries);
            if (priceData) {
                setLegend({
                    open: priceData.open,
                    high: priceData.high,
                    low: priceData.low,
                    close: priceData.close,
                    volume: volumeData?.value,
                    isUp: priceData.close >= priceData.open
                });
            }
        });

        // Resize handler
        const handleResize = () => {
            if (chartContainerRef.current && chart) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight,
                });
            }
        };
        window.addEventListener('resize', handleResize);
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
            chart.remove();
        };
    }, []);

    // Update chart data
    useEffect(() => {
        if (!chartRef.current || !seriesRef.current || series.length === 0) return;

        let candles = series.map(d => ({
            time: d.ts / 1000,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            value: d.close,
        }));

        // Apply Heikin-Ashi if selected
        if (effectiveCandleType === 'Heikin-Ashi') {
            candles = toHeikinAshi(candles);
        }

        const volumes = candles.map((c, i) => ({
            time: c.time,
            value: series[i]?.volume || 0,
            color: c.close >= c.open ? 'rgba(8, 153, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)',
        }));

        // Deduplicate
        const seen = new Set();
        const uniqueCandles = [];
        const uniqueVolumes = [];
        candles.forEach((c, i) => {
            if (!seen.has(c.time)) {
                seen.add(c.time);
                uniqueCandles.push(c);
                uniqueVolumes.push(volumes[i]);
            }
        });

        try {
            seriesRef.current.setData(uniqueCandles);
            volumeSeriesRef.current?.setData(uniqueVolumes);

            if (!chartRef.current._hasFitted) {
                chartRef.current.timeScale().fitContent();
                chartRef.current._hasFitted = true;
            }
        } catch (err) {
            console.error('ChartPanel: Chart error:', err);
        }
    }, [series, effectiveCandleType]);

    // Update Plugin Options
    useEffect(() => {
        if (chartRef.current && chartRef.current.daySeparator && chartSettings.sessionBreaks) {
            chartRef.current.daySeparator.applyOptions(chartSettings.sessionBreaks);
        }
    }, [chartSettings]);

    const fmt = (num) => num == null ? '-' : (num >= 1000 ? num.toFixed(2) : num.toFixed(4));
    const fmtVol = (num) => {
        if (num == null) return '-';
        if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
        if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
        return num.toFixed(0);
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                border: isActive ? '2px solid #3b82f6' : '1px solid #334155',
                borderRadius: '4px',
                overflow: 'hidden',
                ...style
            }}
            onClick={() => onActivate && onActivate(id)}
        >
            {/* Panel Header */}
            {showHeader && (
                <div style={{
                    height: '36px',
                    background: isActive ? '#1e3a5f' : '#1e293b',
                    borderBottom: '1px solid #334155',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    gap: '6px',
                    fontSize: '12px'
                }}>
                    {/* Symbol */}
                    <div
                        onClick={(e) => { e.stopPropagation(); setShowSearch(true); }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            background: '#334155',
                            borderRadius: '3px',
                            cursor: 'pointer',
                        }}
                    >
                        <span style={{ color: '#64748b' }}>🔍</span>
                        <span style={{ color: 'white', fontWeight: 'bold' }}>{symbol}</span>
                    </div>

                    {/* Interval */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowIntervalMenu(!showIntervalMenu); }}
                            style={{
                                padding: '4px 8px',
                                background: '#334155',
                                border: 'none',
                                borderRadius: '3px',
                                color: 'white',
                                cursor: 'pointer',
                            }}
                        >
                            {effectiveInterval} ▼
                        </button>
                        {showIntervalMenu && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: '2px',
                                background: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                padding: '4px',
                                zIndex: 100,
                                minWidth: '80px',
                            }}>
                                {CANDLE_INTERVALS.map(tf => (
                                    <button
                                        key={tf}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onIntervalChange && onIntervalChange(tf);
                                            setShowIntervalMenu(false);
                                        }}
                                        style={{
                                            display: 'block',
                                            width: '100%',
                                            padding: '4px 8px',
                                            background: effectiveInterval === tf ? 'rgba(59,130,246,0.2)' : 'transparent',
                                            border: 'none',
                                            borderRadius: '3px',
                                            color: effectiveInterval === tf ? '#3b82f6' : '#94a3b8',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                        }}
                                    >
                                        {tf}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* OHLC Legend - Day-based values */}
                    {dayOHLC && (
                        <div style={{ display: 'flex', gap: '8px', color: '#94a3b8', marginLeft: 'auto' }}>
                            <span style={{ color: '#64748b', fontSize: '10px', marginRight: '4px' }}>Day:</span>
                            <span>O <span style={{ color: dayOHLC.close >= dayOHLC.open ? '#24c55e' : '#ef4444' }}>{fmt(dayOHLC.open)}</span></span>
                            <span>H <span style={{ color: dayOHLC.close >= dayOHLC.open ? '#24c55e' : '#ef4444' }}>{fmt(dayOHLC.high)}</span></span>
                            <span>L <span style={{ color: dayOHLC.close >= dayOHLC.open ? '#24c55e' : '#ef4444' }}>{fmt(dayOHLC.low)}</span></span>
                            <span>C <span style={{ color: dayOHLC.close >= dayOHLC.open ? '#24c55e' : '#ef4444' }}>{fmt(dayOHLC.close)}</span></span>
                        </div>
                    )}
                </div>
            )}

            {/* Chart Container */}
            <div ref={chartContainerRef} style={{ flex: 1, minHeight: 0 }} />

            {/* Search Popover */}
            {showSearch && (
                <SearchPopover
                    coins={availableCoins}
                    onSelect={(c) => {
                        onSymbolChange && onSymbolChange(c.symbol);
                        setShowSearch(false);
                    }}
                    onClose={() => setShowSearch(false)}
                />
            )}
        </div>
    );
}

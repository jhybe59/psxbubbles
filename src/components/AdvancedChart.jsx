import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, AreaSeries, LineSeries } from 'lightweight-charts';
import { IndicatorButton, IndicatorSelector, ActiveIndicatorsDropdown, IndicatorSettingsModal } from './indicators';
import { getIndicator, getActiveIndicators, setActiveIndicators, addIndicator, removeIndicator, toggleIndicatorVisibility, updateIndicator, getCandleType, setCandleType } from '../lib/indicators';
import { toHeikinAshi } from '../lib/heikinAshi';
import ChartControls from './ChartControls';

const THEME_DARK = {
    layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#D1D4DC',
    },
    grid: {
        vertLines: { color: '#363a45', style: 1 },
        horzLines: { color: '#363a45', style: 1 },
    },
    crosshair: {
        mode: 0, // Normal (free) mode
    },
    rightPriceScale: {
        borderColor: '#363a45',
    },
    timeScale: {
        borderColor: '#363a45',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time, tickMarkType, locale) => {
            const date = new Date(time * 1000);
            const options = { timeZone: 'Asia/Karachi' };
            return date.toLocaleDateString('en-PK', { ...options, month: 'short', day: 'numeric' }) + ' ' +
                date.toLocaleTimeString('en-PK', { ...options, hour: '2-digit', minute: '2-digit', hour12: false });
        },
    },
    localization: {
        timeFormatter: (time) => {
            const date = new Date(time * 1000);
            const options = { timeZone: 'Asia/Karachi' };
            return date.toLocaleDateString('en-PK', { ...options, month: 'short', day: 'numeric' }) + ' ' +
                date.toLocaleTimeString('en-PK', { ...options, hour: '2-digit', minute: '2-digit', hour12: false });
        },
    },
};

const AREA_TIMEFRAMES = ['Hour', 'Day', 'Week', 'Month', 'Year', '100 Ticks', '1000 Ticks'];
const CANDLE_INTERVALS = ['10 Ticks', '100 Ticks', '500 Ticks', '1000 Ticks', '1m', '5m', '15m', '1h', '4h', 'Day', 'Week', 'Month', 'Year'];
const CHART_TYPES = ['Candles', 'Heikin-Ashi', 'Area'];

export default function AdvancedChart({ data = [], symbol, onClose, timeframe, onTimeframeChange, chartType, setChartType, candleType, setCandleType }) {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const [chartInstance, setChartInstance] = useState(null);
    const seriesRef = useRef(null);
    const volumeSeriesRef = useRef(null);
    const [showIntervalMenu, setShowIntervalMenu] = useState(false);
    // chartType is now controlled from parent (CoinModal), but we can default if not passed (for standalone usage)
    const [localChartType, setLocalChartType] = useState(chartType || 'Candles');
    const effectiveChartType = chartType !== undefined ? chartType : localChartType;
    const handleSetChartType = setChartType || setLocalChartType;
    // candleType for Heikin-Ashi support
    const [localCandleType, setLocalCandleType] = useState(candleType || 'Candles');
    const effectiveCandleType = candleType !== undefined ? candleType : localCandleType;
    const handleSetCandleType = setCandleType || setLocalCandleType;
    const [legend, setLegend] = useState(null);


    // Indicators state
    const [activeIndicators, setActiveIndicatorsState] = useState([]);
    const [showIndicatorSelector, setShowIndicatorSelector] = useState(false);
    const [editingIndicator, setEditingIndicator] = useState(null);
    const [indicatorValues, setIndicatorValues] = useState({});
    const indicatorSeriesRef = useRef({}); // Map of instanceId -> series

    // Load indicators from storage on mount AND sync across tabs
    useEffect(() => {
        const loadIndicators = () => {
            const stored = getActiveIndicators('default');
            setActiveIndicatorsState(stored);
        };

        loadIndicators();

        // Listen for localStorage changes FROM OTHER TABS only
        const handleStorageChange = (e) => {
            if (e.key === 'chart_indicators_layout' || e.key === null) {
                loadIndicators();
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    // Initialize Chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        let chart = null;

        try {
            chart = createChart(chartContainerRef.current, {
                ...THEME_DARK,
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight,
            });
            chartRef.current = chart;
            setChartInstance(chart);

            // Add Main Series based on type
            let mainSeries;
            if (effectiveChartType === 'Area') {
                mainSeries = chart.addSeries(AreaSeries, {
                    topColor: 'rgba(38, 166, 154, 0.56)',
                    bottomColor: 'rgba(38, 166, 154, 0.04)',
                    lineColor: 'rgba(38, 166, 154, 1)',
                    lineWidth: 2,
                });
            } else {
                mainSeries = chart.addSeries(CandlestickSeries, {
                    upColor: '#089981',
                    downColor: '#ef4444',
                    borderVisible: false,
                    wickUpColor: '#089981',
                    wickDownColor: '#ef4444',
                });
            }
            seriesRef.current = mainSeries;

            // Add Volume Series (Overlay) on a separate scale 'volume'
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

            // Set main scale margins
            chart.priceScale('right').applyOptions({
                scaleMargins: { top: 0.1, bottom: 0.1 },
            });

            // Subscribe to crosshair move
            chart.subscribeCrosshairMove((param) => {
                if (
                    param.point === undefined ||
                    !param.time ||
                    param.point.x < 0 ||
                    param.point.x > chartContainerRef.current.clientWidth ||
                    param.point.y < 0 ||
                    param.point.y > chartContainerRef.current.clientHeight
                ) {
                    setLegend(null);
                } else {
                    const priceData = param.seriesData.get(mainSeries);
                    const volumeData = param.seriesData.get(volumeSeries);
                    if (priceData) {
                        setLegend({
                            open: priceData.open || priceData.value,
                            high: priceData.high || priceData.value,
                            low: priceData.low || priceData.value,
                            close: priceData.close || priceData.value,
                            volume: volumeData ? volumeData.value : undefined,
                            isUp: (priceData.close || priceData.value) >= (priceData.open || priceData.value)
                        });
                    }
                }
            });

            // Handle resize
            const handleResize = () => {
                if (chartContainerRef.current && chart) {
                    chart.applyOptions({
                        width: chartContainerRef.current.clientWidth,
                        height: chartContainerRef.current.clientHeight,
                    });
                }
            };
            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
                if (chart) {
                    chart.remove();
                    chartRef.current = null;
                }
                // Clear indicator series refs so they get recreated on new chart
                indicatorSeriesRef.current = {};
            };

        } catch (e) {
            console.error('Failed to init AdvancedChart:', e);
            return () => { };
        }
    }, [effectiveChartType]); // Re-init chart when type changes

    // Reset fit flag when timeframe changes so chart refits once on new data
    useEffect(() => {
        if (chartRef.current) {
            chartRef.current._hasFitted = false;
        }
    }, [timeframe]);

    // Data Update
    useEffect(() => {
        if (!chartRef.current || !seriesRef.current || !data) return;

        let candles = [];
        const volumes = [];

        data.forEach(d => {
            const time = d.ts / 1000;
            const open = Number(d.open);
            const high = Number(d.high);
            const low = Number(d.low);
            const close = Number(d.close);
            const volume = Number(d.volume);

            if (Number.isFinite(time) && Number.isFinite(open) && Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)) {
                const item = {
                    time: time,
                    open: open,
                    high: high,
                    low: low,
                    close: close,
                    value: close, // For Area/Line series
                };

                candles.push(item);

                volumes.push({
                    time: time,
                    value: Number.isFinite(volume) ? volume : 0,
                    color: close >= open ? 'rgba(8, 153, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)',
                });
            }
        });

        // Apply Heikin-Ashi transformation if selected
        if (effectiveCandleType === 'Heikin-Ashi' && candles.length > 0) {
            candles = toHeikinAshi(candles);
            // Update volume colors based on HA candles
            candles.forEach((c, i) => {
                if (volumes[i]) {
                    volumes[i].color = c.close >= c.open ? 'rgba(8, 153, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)';
                }
            });
        }

        if (candles.length > 0) {
            try {
                // Deduplicate to avoid LC errors
                const uniqueCandles = [];
                const uniqueVolumes = [];
                const seen = new Set();

                for (let i = 0; i < candles.length; i++) {
                    const t = candles[i].time;
                    if (!seen.has(t)) {
                        seen.add(t);
                        uniqueCandles.push(candles[i]);
                        uniqueVolumes.push(volumes[i]);
                    }
                }

                seriesRef.current.setData(uniqueCandles);
                if (volumeSeriesRef.current) {
                    volumeSeriesRef.current.setData(uniqueVolumes);
                }

                // Set initial legend to latest candle
                if (uniqueCandles.length > 0) {
                    const last = uniqueCandles[uniqueCandles.length - 1];
                    const lastVol = uniqueVolumes[uniqueVolumes.length - 1];
                    setLegend({
                        open: last.open || last.value,
                        high: last.high || last.value,
                        low: last.low || last.value,
                        close: last.close || last.value,
                        volume: lastVol ? lastVol.value : undefined,
                        isUp: (last.close || last.value) >= (last.open || last.value)
                    });
                }

                // Only fit content on first load or manual timeframe change, NOT on every tick update
                // We can check if we already have data visible or use a ref
                if (!chartRef.current._hasFitted) {
                    chartRef.current.timeScale().fitContent();
                    chartRef.current._hasFitted = true;
                }
            } catch (err) {
                console.error('LightweightCharts Error (Advanced):', err);
            }
        }
    }, [data, effectiveChartType, effectiveCandleType]); // Re-run when data, chartType, or candleType changes

    // Calculate and render indicator series
    useEffect(() => {
        if (!chartRef.current || !data || data.length === 0) return;

        const candles = data.map(d => ({
            time: d.ts / 1000,
            open: Number(d.open),
            high: Number(d.high),
            low: Number(d.low),
            close: Number(d.close),
            volume: Number(d.volume) || 0
        })).filter(c => Number.isFinite(c.close));

        // Remove old indicator series
        const activeIds = new Set(activeIndicators.map(ind => ind.instanceId));
        for (const [instanceId, seriesMap] of Object.entries(indicatorSeriesRef.current)) {
            if (!activeIds.has(instanceId)) {
                if (seriesMap) {
                    const seriesList = seriesMap.applyOptions ? [seriesMap] : Object.values(seriesMap);
                    seriesList.forEach(s => {
                        try { chartRef.current.removeSeries(s); } catch (e) { }
                    });
                }
                delete indicatorSeriesRef.current[instanceId];
            }
        }

        // Calculate and render each active indicator
        const newValues = {};
        activeIndicators.forEach(ind => {
            const def = getIndicator(ind.indicatorId);
            if (!def) return;

            // Ensure we have a storage object for this indicator's series
            if (!indicatorSeriesRef.current[ind.instanceId]) {
                indicatorSeriesRef.current[ind.instanceId] = {};
            }
            const instanceSeriesMap = indicatorSeriesRef.current[ind.instanceId];

            // Calculate values
            const values = def.calculate(candles, ind.params);

            // Handle plots (formatted outputs)
            const plots = def.plots && def.plots.length > 0
                ? def.plots
                : [{ id: 'main', type: 'line', title: 'Plot' }];

            // Normalize values for display
            const lastVal = Array.isArray(values)
                ? values.filter(v => v !== null).pop()
                : (values[plots[0].id] ? values[plots[0].id].filter(v => v !== null).pop() : null);
            newValues[ind.instanceId] = lastVal;

            plots.forEach(plot => {
                try {
                    const plotId = plot.id;

                    // Get style (fallback to legacy behavior if needed)
                    const styleDef = (ind.styles && ind.styles[plotId]) ? ind.styles[plotId] : {
                        color: ind.color || '#2962FF',
                        lineWidth: 2,
                        visible: true,
                        type: plot.type
                    };

                    const plotDataRaw = Array.isArray(values) ? values : values[plotId];
                    if (!plotDataRaw) return;

                    // Create Series if missing
                    if (!instanceSeriesMap[plotId]) {
                        let series;
                        try {
                            const seriesOptions = {
                                color: styleDef.color,
                                lineWidth: styleDef.lineWidth || 2,
                                priceLineVisible: false,
                                lastValueVisible: false,
                                crosshairMarkerVisible: true,
                                priceScaleId: plot.priceScaleId || 'right',
                            };

                            if (plot.priceScaleId && plot.scaleMargins) {
                                chartRef.current.priceScale(plot.priceScaleId).applyOptions({
                                    scaleMargins: plot.scaleMargins,
                                    visible: false
                                });
                            }

                            if (plot.type === 'histogram') {
                                series = chartRef.current.addSeries(HistogramSeries, seriesOptions);
                            } else {
                                series = chartRef.current.addSeries(LineSeries, seriesOptions);
                            }
                            instanceSeriesMap[plotId] = series;
                        } catch (e) {
                            console.error(`Failed to create series for ${ind.name} (${plotId})`, e);
                            return;
                        }
                    }

                    const series = instanceSeriesMap[plotId];

                    // Update Style
                    series.applyOptions({
                        color: styleDef.color,
                        lineWidth: styleDef.lineWidth || 2,
                        lineStyle: styleDef.lineStyle ?? 0, // 0=Solid, 1=Dashed, 2=Dotted
                        lineType: styleDef.lineType ?? 0, // 0=Simple, 1=Step, 2=Curved
                        visible: styleDef.visible !== false && (ind.visible !== false)
                    });

                    // Set Data
                    let seriesData = [];

                    if (styleDef.lineType === 1 && styleDef.tvStepLogic) {
                        // Left Shift Logic
                        for (let i = 1; i < candles.length; i++) {
                            if (plotDataRaw[i] !== null && Number.isFinite(plotDataRaw[i])) {
                                seriesData.push({
                                    time: candles[i - 1].time,
                                    value: plotDataRaw[i]
                                });
                            }
                        }
                        if (candles.length > 0) {
                            const lastIdx = candles.length - 1;
                            if (plotDataRaw[lastIdx] !== null && Number.isFinite(plotDataRaw[lastIdx])) {
                                seriesData.push({
                                    time: candles[lastIdx].time,
                                    value: plotDataRaw[lastIdx]
                                });
                            }
                        }
                    } else {
                        seriesData = candles.map((c, i) => {
                            const raw = plotDataRaw[i];
                            if (raw !== null && typeof raw === 'object') {
                                return { time: c.time, ...raw };
                            }
                            return { time: c.time, value: raw };
                        }).filter(d => d.value !== null && Number.isFinite(Number(d.value)));
                    }

                    try { series.setData(seriesData); } catch (e) { }
                } catch (err) {
                    console.error(`Error rendering plot ${plot.id} for indicator ${ind.name}:`, err);
                }
            });
        });

        setIndicatorValues(newValues);
    }, [data, activeIndicators, chartInstance]); // chartInstance ensures re-run after chart init

    // Indicator handlers
    const handleAddIndicator = useCallback((indicator) => {
        const updated = addIndicator('default', indicator);
        setActiveIndicatorsState(updated);
        setShowIndicatorSelector(false);
    }, []);

    const handleRemoveIndicator = useCallback((instanceId) => {
        const updated = removeIndicator('default', instanceId);
        setActiveIndicatorsState(updated);
    }, []);

    const handleToggleVisibility = useCallback((instanceId) => {
        const updated = toggleIndicatorVisibility('default', instanceId);
        setActiveIndicatorsState(updated);
    }, []);

    const handleUpdateIndicator = (instanceId, { params, styles }) => {
        const updated = updateIndicator('default', instanceId, { params, styles });
        setActiveIndicatorsState(updated);
        setEditingIndicator(null);
    };


    const fmt = (num) => {
        if (num == null) return '-';
        if (num >= 1000) return num.toFixed(2);
        return num.toFixed(4);
    };

    const fmtVol = (num) => {
        if (num == null) return '-';
        if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
        if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
        return num.toFixed(0);
    };

    const chartContent = (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
            {/* ======= TOP BAR ======= */}
            <div style={{
                height: '48px',
                background: '#1e293b',
                borderBottom: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                gap: '8px'
            }}>
                {/* Symbol */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#334155',
                    borderRadius: '4px',
                    cursor: 'default'
                }}>
                    <span style={{ color: '#64748b', fontSize: '14px' }}>🔍</span>
                    <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>{symbol}</span>
                </div>

                {/* Interval Dropdown */}
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => setShowIntervalMenu(!showIntervalMenu)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            background: '#334155',
                            border: 'none',
                            borderRadius: '4px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 500
                        }}
                    >
                        {timeframe || 'Day'} <span style={{ color: '#64748b', fontSize: '10px' }}>▼</span>
                    </button>

                    {showIntervalMenu && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: '4px',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            padding: '4px',
                            zIndex: 200,
                            minWidth: '100px'
                        }}>
                            {(effectiveChartType === 'Candles' ? CANDLE_INTERVALS : AREA_TIMEFRAMES).map(tf => (
                                <button
                                    key={tf}
                                    onClick={() => {
                                        if (onTimeframeChange) onTimeframeChange(tf);
                                        setShowIntervalMenu(false);
                                    }}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: timeframe === tf ? 'rgba(59,130,246,0.2)' : 'transparent',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: timeframe === tf ? '#3b82f6' : '#94a3b8',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        textAlign: 'left'
                                    }}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Chart Type Toggle */}
                {/* Chart Type Toggle - includes candle type option */}
                <div style={{ display: 'flex', background: '#334155', borderRadius: '4px', padding: '2px' }}>
                    {CHART_TYPES.map(type => {
                        const isActive = type === 'Area'
                            ? effectiveChartType === 'Area'
                            : (effectiveChartType === 'Candles' && effectiveCandleType === type);
                        return (
                            <button
                                key={type}
                                onClick={() => {
                                    if (type === 'Area') {
                                        handleSetChartType('Area');
                                    } else {
                                        handleSetChartType('Candles');
                                        handleSetCandleType(type);
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

                {/* Indicators Button - Left aligned after Chart Type */}
                {effectiveChartType !== 'Area' && (
                    <IndicatorButton
                        onClick={() => setShowIndicatorSelector(true)}
                        activeCount={activeIndicators.length}
                    />
                )}

                {/* OHLC Legend */}
                {legend && (
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontFamily: 'monospace', color: '#94a3b8', marginLeft: '12px', alignItems: 'center' }}>
                        <span>O <span style={{ color: legend.isUp ? '#24c55e' : '#ef4444' }}>{fmt(legend.open)}</span></span>
                        <span>H <span style={{ color: legend.isUp ? '#24c55e' : '#ef4444' }}>{fmt(legend.high)}</span></span>
                        <span>L <span style={{ color: legend.isUp ? '#24c55e' : '#ef4444' }}>{fmt(legend.low)}</span></span>
                        <span>C <span style={{ color: legend.isUp ? '#24c55e' : '#ef4444' }}>{fmt(legend.close)}</span></span>
                        {legend.volume !== undefined && (
                            <span>Vol <span style={{ color: '#bae6fd' }}>{fmtVol(legend.volume)}</span></span>
                        )}
                    </div>
                )}
                <div style={{ flex: 1 }} />

                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        padding: '6px 14px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '4px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 500
                    }}
                >
                    ✕ Close
                </button>
            </div>

            {/* ======= MAIN CONTENT ======= */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                {/* CHART CONTAINER - Now takes full width since sidebar is removed */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#111827' }}>
                    <div
                        style={{ flex: 1, minHeight: 0, position: 'relative' }}
                        ref={chartContainerRef}
                    >
                        {/* Active Indicators Dropdown - Right corner */}
                        {activeIndicators.length > 0 && (
                            <ActiveIndicatorsDropdown
                                indicators={activeIndicators}
                                indicatorValues={indicatorValues}
                                onToggleVisibility={handleToggleVisibility}
                                onRemove={handleRemoveIndicator}
                                onSettings={setEditingIndicator}
                                placement="left"
                            />
                        )}

                        {/* Chart Controls - Floating Bottom Center */}
                        {chartInstance && (
                            <ChartControls chart={chartInstance} />
                        )}
                    </div>
                </div>
            </div>

            {/* Indicator Selector Popup */}
            <IndicatorSelector
                isOpen={showIndicatorSelector}
                onClose={() => setShowIndicatorSelector(false)}
                onAddIndicator={handleAddIndicator}
            />

            {/* Indicator Settings Modal */}
            <IndicatorSettingsModal
                isOpen={!!editingIndicator}
                onClose={() => setEditingIndicator(null)}
                indicator={editingIndicator}
                onSave={handleUpdateIndicator}
            />
        </div>
    );

    return createPortal(chartContent, document.body);
}

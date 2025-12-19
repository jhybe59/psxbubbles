import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, AreaSeries, LineSeries } from 'lightweight-charts';
import DaySeparatorPlugin from '../lib/chart/DaySeparatorPlugin';
import { IndicatorSelector, ActiveIndicatorsDropdown, IndicatorSettingsModal } from './indicators';
import { getIndicator, getActiveIndicators, setActiveIndicators, addIndicator, removeIndicator, toggleIndicatorVisibility, updateIndicator } from '../lib/indicators';
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
        rightOffset: 12, // Default padding from right edge
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

const EmbeddedChart = React.forwardRef(({ data = [], symbol, height = 300, onFullscreen, chartType = 'Candles', candleType = 'Candles', onActiveCountChange }, ref) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const [chartInstance, setChartInstance] = useState(null);
    const seriesRef = useRef(null);
    const volumeSeriesRef = useRef(null);

    const [isHovered, setIsHovered] = useState(false);

    // Indicators state
    const [activeIndicators, setActiveIndicatorsState] = useState([]);
    const [showIndicatorSelector, setShowIndicatorSelector] = useState(false);
    const [editingIndicator, setEditingIndicator] = useState(null);
    const [indicatorValues, setIndicatorValues] = useState({});
    const indicatorSeriesRef = useRef({}); // Map of instanceId -> series

    // Chart Settings (Global)
    const [chartSettings, setChartSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('advancedChart_settings');
            return saved ? JSON.parse(saved) : {
                sessionBreaks: { visible: false, color: '#363a45', lineStyle: 1, lineWidth: 1, opacity: 0.5 }
            };
        } catch {
            return { sessionBreaks: { visible: false, color: '#363a45', lineStyle: 1, lineWidth: 1, opacity: 0.5 } };
        }
    });

    // Load indicators from storage on mount AND sync across tabs
    useEffect(() => {
        const loadIndicators = () => {
            const stored = getActiveIndicators('default');
            setActiveIndicatorsState(stored);
            if (onActiveCountChange) onActiveCountChange(stored.length);
        };

        loadIndicators();

        // Listen for localStorage changes FROM OTHER TABS only
        // Same-tab changes are handled by direct state updates in save handlers
        const handleStorageChange = (e) => {
            if (e.key === 'chart_indicators_layout' || e.key === null) {
                loadIndicators();
            }
            if (e.key === 'advancedChart_settings' || e.key === null) {
                try {
                    const saved = localStorage.getItem('advancedChart_settings');
                    if (saved) setChartSettings(JSON.parse(saved));
                } catch { }
            }
        };
        window.addEventListener('storage', handleStorageChange);

        // Custom event listener for same-tab updates (dispatched from AdvancedChart if needed, or by us)
        // Since AdvancedChart uses setItem, 'storage' event only fires on OTHER tabs.
        // For same-tab syncing, we might need a custom event or check on focus.
        // But for now, storage event covers multi-window/tab. 
        // If user changes setting in AdvancedChart in SAME window, it won't fire 'storage' event.
        // We'll rely on re-mount or manual firing if we want perfect sync in same window.

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [onActiveCountChange]);

    // Sync active count on change
    useEffect(() => {
        if (onActiveCountChange) onActiveCountChange(activeIndicators.length);
    }, [activeIndicators, onActiveCountChange]);

    // Expose openIndicators to parent
    React.useImperativeHandle(ref, () => ({
        openIndicators: () => setShowIndicatorSelector(true)
    }));

    // Resize observer to handle container resizing
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            if (!chartRef.current) return;
            const { width, height } = entries[0].contentRect;
            chartRef.current.applyOptions({ width, height });
        });

        resizeObserver.observe(chartContainerRef.current);

        return () => resizeObserver.disconnect();
    }, []);

    // Initialize Chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        let chart = null;


        // Create Chart
        chart = createChart(chartContainerRef.current, {
            ...THEME_DARK,
            width: chartContainerRef.current.clientWidth,
            height: height,
        });

        chartRef.current = chart;
        setChartInstance(chart);

        // Add Main Series based on chartType
        let mainSeries;
        if (chartType === 'Area') {
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

        // Day Separator Plugin
        const daySeparator = new DaySeparatorPlugin();
        if (chartSettings && chartSettings.sessionBreaks) {
            daySeparator.applyOptions(chartSettings.sessionBreaks);
        }
        mainSeries.attachPrimitive(daySeparator);
        chartRef.current.daySeparator = daySeparator;


        // Add Volume Series (Overlay) on a separate scale 'volume'
        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: 'volume',
        });
        volumeSeriesRef.current = volumeSeries;

        // Configure the 'volume' scale to sit at the bottom (overlay)
        chart.priceScale('volume').applyOptions({
            scaleMargins: {
                top: 0.8, // Top 80% is empty, volume sits in bottom 20%
                bottom: 0,
            },
            visible: false, // Hide the price axis for volume
        });

        // Configure the main scale (candles) to take up most of the space
        chart.priceScale('right').applyOptions({
            scaleMargins: {
                top: 0.1,
                bottom: 0.1, // Leave some space
            },
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
                // Get price data
                const priceData = param.seriesData.get(mainSeries);
                // Get volume data
                const volumeData = param.seriesData.get(volumeSeries);

                if (priceData) {
                    setLegend({
                        open: priceData.open || priceData.value, // Support Area series (value) or Candle (open)
                        high: priceData.high || priceData.value,
                        low: priceData.low || priceData.value,
                        close: priceData.close || priceData.value,
                        volume: volumeData ? volumeData.value : undefined,
                        isUp: (priceData.close || priceData.value) >= (priceData.open || priceData.value)
                    });
                }
            }
        });



        return () => {
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
            // Clear indicator series refs so they get recreated on new chart
            indicatorSeriesRef.current = {};
        };
    }, [height, chartType]); // Re-init on type change

    // Update Data
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
                    value: close, // Explicitly add value for Area series
                };
                candles.push(item);

                const isUp = close >= open;
                volumes.push({
                    time: time,
                    value: Number.isFinite(volume) ? volume : 0,
                    color: isUp ? 'rgba(8, 153, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)',
                });
            }
        });

        // Apply Heikin-Ashi transformation if selected
        if (candleType === 'Heikin-Ashi' && candles.length > 0) {
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
                // Deduplicate by time to prevent LC errors
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

                // Fit content only on first load, not on every tick update
                setTimeout(() => {
                    if (chartRef.current && !chartRef.current._hasFitted) {
                        chartRef.current.timeScale().fitContent();
                        chartRef.current._hasFitted = true;
                    }
                }, 0);

            } catch (err) {
                console.error('[EmbeddedChart] LightweightCharts Error:', err);
            }
        }
    }, [data, chartType, candleType]); // Depend on chartType and candleType too to ensure re-render consistency

    // Update Plugin when settings change
    useEffect(() => {
        if (chartRef.current && chartRef.current.daySeparator && chartSettings.sessionBreaks) {
            chartRef.current.daySeparator.applyOptions(chartSettings.sessionBreaks);
        }
    }, [chartSettings]);


    // Calculate and render indicator series
    useEffect(() => {
        if (!chartRef.current || !data || data.length === 0) return;

        // Convert data to candles format for calculations
        const candles = data.map(d => ({
            time: d.ts / 1000,
            open: Number(d.open),
            high: Number(d.high),
            low: Number(d.low),
            close: Number(d.close),
            volume: Number(d.volume) || 0
        })).filter(c => Number.isFinite(c.close));

        // Remove old indicator series that are no longer active
        const activeIds = new Set(activeIndicators.map(ind => ind.instanceId));
        for (const [instanceId, seriesMap] of Object.entries(indicatorSeriesRef.current)) {
            if (!activeIds.has(instanceId)) {
                // seriesMap is now an object { [plotId]: series } (or legacy single series? No, we'll force object)
                // Handle legacy or null
                if (seriesMap) {
                    const seriesList = seriesMap.applyOptions ? [seriesMap] : Object.values(seriesMap);
                    seriesList.forEach(s => {
                        try {
                            chartRef.current.removeSeries(s);
                        } catch (e) { /* ignore */ }
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
            const values = def.calculate(candles, ind.params); // Array or Object

            // Handle plots (formatted outputs)
            // If plots not defined, assume 'main' line
            const plots = def.plots && def.plots.length > 0
                ? def.plots
                : [{ id: 'main', type: 'line', title: 'Plot' }];

            // Normalize values for display (just show last val of first plot for now in legend?)
            // We'll store the whole result for legend logic if needed, but here simple map:
            const lastVal = Array.isArray(values)
                ? values.filter(v => v !== null).pop()
                : (values[plots[0].id] ? values[plots[0].id].filter(v => v !== null).pop() : null);
            newValues[ind.instanceId] = lastVal;

            plots.forEach(plot => {
                try {
                    const plotId = plot.id;

                    // Get style from instance (or fallback defaults if newly added plot)
                    const styleDef = (ind.styles && ind.styles[plotId]) ? ind.styles[plotId] : {
                        color: ind.color || '#2962FF',
                        lineWidth: 2,
                        visible: true,
                        type: plot.type
                    };

                    // Get specific data series for this plot
                    const plotDataRaw = Array.isArray(values) ? values : values[plotId];
                    if (!plotDataRaw) return;

                    // Create Series if missing
                    if (!instanceSeriesMap[plotId]) {
                        // ... series creation logic ...
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

                    series.applyOptions({
                        color: styleDef.color,
                        lineWidth: styleDef.lineWidth || 2,
                        lineStyle: styleDef.lineStyle ?? 0,
                        lineType: styleDef.lineType ?? 0,
                        visible: styleDef.visible !== false && (ind.visible !== false)
                    });

                    let seriesData = [];

                    if (styleDef.lineType === 1 && styleDef.tvStepLogic) {
                        // ... Step logic ...
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
                            return {
                                time: c.time,
                                value: raw
                            };
                        }).filter(d => d.value !== null && Number.isFinite(Number(d.value)));
                    }

                    series.setData(seriesData);
                } catch (err) {
                    console.error(`Error rendering plot ${plot.id} for indicator ${ind.name}:`, err);
                } // End try-catch
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
        setActiveIndicatorsState(updated); // Update state
        setEditingIndicator(null);
    };

    // Helper to format numbers for the legend
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

    // State for the legend (OHLC values)
    const [legend, setLegend] = useState(null);

    const chartContent = (
        <div
            style={{ display: 'flex', width: '100%', height: `${height}px`, borderRadius: '8px', overflow: 'hidden', border: '1px solid #334155' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* MAIN AREA */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* TOP BAR (Compact) */}
                <div style={{
                    height: '32px',
                    background: '#1e293b',
                    borderBottom: '1px solid #334155',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    gap: '12px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#e2e8f0' }}>
                        {symbol}
                    </div>

                    {/* OHLC LEGEND */}
                    {legend && (
                        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8' }}>
                            <span>O <span style={{ color: legend.isUp ? '#24c55e' : '#ef4444' }}>{fmt(legend.open)}</span></span>
                            <span>H <span style={{ color: legend.isUp ? '#24c55e' : '#ef4444' }}>{fmt(legend.high)}</span></span>
                            <span>L <span style={{ color: legend.isUp ? '#24c55e' : '#ef4444' }}>{fmt(legend.low)}</span></span>
                            <span>C <span style={{ color: legend.isUp ? '#24c55e' : '#ef4444' }}>{fmt(legend.close)}</span></span>
                            {legend.volume !== undefined && (
                                <span>Vol <span style={{ color: '#bae6fd' }}>{fmtVol(legend.volume)}</span></span>
                            )}
                            {legend.open && legend.close && (
                                <span style={{ color: legend.isUp ? '#24c55e' : '#ef4444' }}>
                                    {legend.isUp ? '+' : ''}{((legend.close - legend.open) / legend.open * 100).toFixed(2)}%
                                </span>
                            )}
                        </div>
                    )}
                    <div style={{ flex: 1 }} />

                    {/* Fullscreen Button */}
                    {onFullscreen && (
                        <button
                            onClick={onFullscreen}
                            style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                background: 'transparent',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                color: '#94a3b8',
                                cursor: 'pointer'
                            }}
                        >
                            ⛶ Fullscreen
                        </button>
                    )}
                </div>

                {/* CHART */}
                <div style={{ flex: 1, background: '#111827', minHeight: 0, overflow: 'hidden', position: 'relative' }} ref={chartContainerRef}>
                    {/* Active Indicators Dropdown - Position determined by placement prop */}
                    {activeIndicators.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            pointerEvents: 'none'
                        }}>
                            {/* Wrapper for pointer events */}
                            <div style={{ pointerEvents: 'auto', display: 'inline-block' }}>
                                <ActiveIndicatorsDropdown
                                    indicators={activeIndicators}
                                    indicatorValues={indicatorValues}
                                    onToggleVisibility={handleToggleVisibility}
                                    onRemove={handleRemoveIndicator}
                                    onSettings={setEditingIndicator}
                                    placement="left"
                                />
                            </div>
                        </div>
                    )}

                    {/* Chart canvas will be injected here */}
                    {(!data || data.length === 0) && (
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#475569',
                            fontSize: '14px',
                            zIndex: 10
                        }}>
                            No data available
                        </div>
                    )}
                    {/* Chart Controls - Floating Bottom Center */}
                    {chartInstance && (
                        <ChartControls
                            chart={chartInstance}
                            size="small"
                        />
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <>
            {chartContent}
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
        </>
    );
}); // End forwardRef

EmbeddedChart.displayName = 'EmbeddedChart';
export default EmbeddedChart;

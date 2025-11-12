import React, { useEffect, useRef } from 'react';

// Props:
// - series: array of { ts, open, high, low, close, volume }
// - height: px height (optional)
// - pct: percent change (optional) to choose color
export default function InteractiveChart({ series = [], height = 140, pct = 0 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const seriesKindRef = useRef(null);
  const latestSeriesRef = useRef(series);
  const debugRef = useRef(null);

  latestSeriesRef.current = series;

  // Initialize chart dynamically to avoid bundler alias issues
  useEffect(() => {
    let ro = null;

    async function initChart() {
      const containerEl = containerRef.current;
      if (!containerEl) return;
      try {
        // Prefer a global UMD build if available (we inject it in index.html as a fallback),
        // otherwise import the package normally so Vite can optimize it.
        const mod = await (async () => {
          if (typeof window !== 'undefined' && window.LightweightCharts) {
            return window.LightweightCharts;
          }
          return await import('lightweight-charts');
        })();

        const lwc =
          (mod && typeof mod === 'object' && typeof mod.createChart === 'function') ? mod :
          (mod && typeof mod === 'object' && mod.default && typeof mod.default.createChart === 'function') ? mod.default :
          mod;

        // show exports for diagnosis
        try {
          const keys = lwc && typeof lwc === 'object' ? Object.keys(lwc) : [];
          console.debug('InteractiveChart: lightweight-charts exports', keys);
          if (debugRef.current) debugRef.current.textContent = `lwc exports:${keys.length}`;
        } catch (e) { console.debug('InteractiveChart: export inspection failed', e); }

        const createChart = lwc?.createChart;
        if (typeof createChart !== 'function') {
          console.error('InteractiveChart: createChart not found on module', mod);
          if (debugRef.current) debugRef.current.textContent = 'createChart missing';
          return;
        }

        // remove existing chart if any
        if (chartRef.current) {
          try {
            chartRef.current.remove();
          } catch (removeErr) {
            console.debug('InteractiveChart: previous chart remove failed', removeErr);
          }
          chartRef.current = null;
          seriesRef.current = null;
          seriesKindRef.current = null;
        }

        const chart = createChart(containerEl, {
          width: containerEl.clientWidth || 400,
          height,
          layout: { background: { type: 'solid', color: '#071014' }, textColor: '#dfe7e7' },
          grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
          crosshair: { mode: 1 },
          rightPriceScale: { visible: true, borderColor: 'rgba(255,255,255,0.04)' },
          timeScale: { borderColor: 'rgba(255,255,255,0.04)' }
        });
        chartRef.current = chart;

        // Diagnostic: log chart own keys and prototype methods to help identify missing APIs
        try {
          const own = Object.getOwnPropertyNames(chart).join(',');
          const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(chart)).join(',');
          console.debug('InteractiveChart: chart own props ->', own);
          console.debug('InteractiveChart: chart proto methods ->', proto);
          if (debugRef.current) debugRef.current.textContent = `chart.props:${own.split(',').length} proto:${proto.split(',').length}`;
        } catch (e) {
          console.debug('InteractiveChart: diagnostic failed', e);
        }

        const chartHasAddSeries = typeof chart.addSeries === 'function';
        console.debug('InteractiveChart: chart addSeries available?', chartHasAddSeries);
        if (debugRef.current) {
          debugRef.current.textContent = `init exports:${(lwc && typeof lwc === 'object' ? Object.keys(lwc).length : 0)} addSeries:${chartHasAddSeries}`;
        }

        // Prefer area series, fall back to line or candle if needed
        const seriesDefinitions = {
          area: lwc?.AreaSeries,
          line: lwc?.LineSeries,
          candle: lwc?.CandlestickSeries
        };

        const addSeries = (definition, options, legacyAdder, label) => {
          if (definition && typeof chart.addSeries === 'function') {
            try {
              return chart.addSeries(definition, options);
            } catch (e) {
              console.warn('InteractiveChart: addSeries threw, attempting legacy fallback', e);
              if (debugRef.current) debugRef.current.textContent = `addSeries (${label}) error: ${String(e && e.message ? e.message : e)}`;
            }
          }
          if (typeof legacyAdder === 'function') {
            return legacyAdder(options);
          }
          return null;
        };

        let chartSeries = null;

        if (seriesDefinitions.area || typeof chart.addAreaSeries === 'function') {
          chartSeries = addSeries(
            seriesDefinitions.area,
            { topColor: pct >= 0 ? 'rgba(36,197,94,0.36)' : 'rgba(255,77,77,0.22)', bottomColor: 'rgba(7,16,20,0)', lineColor: pct >= 0 ? '#23c55e' : '#ff6b6b', lineWidth: 2 },
            typeof chart.addAreaSeries === 'function' ? chart.addAreaSeries.bind(chart) : null,
            'area'
          );
          if (chartSeries) seriesKindRef.current = 'area';
        }

        if (!chartSeries && (seriesDefinitions.line || typeof chart.addLineSeries === 'function')) {
          chartSeries = addSeries(
            seriesDefinitions.line,
            { color: pct >= 0 ? '#23c55e' : '#ff6b6b', lineWidth: 2 },
            typeof chart.addLineSeries === 'function' ? chart.addLineSeries.bind(chart) : null,
            'line'
          );
          if (chartSeries) seriesKindRef.current = 'line';
        }

        if (!chartSeries && (seriesDefinitions.candle || typeof chart.addCandlestickSeries === 'function')) {
          chartSeries = addSeries(
            seriesDefinitions.candle,
            { upColor: '#23c55e', downColor: '#ff6b6b' },
            typeof chart.addCandlestickSeries === 'function' ? chart.addCandlestickSeries.bind(chart) : null,
            'candlestick'
          );
          if (chartSeries) seriesKindRef.current = 'candlestick';
        }

        if (!chartSeries) {
          seriesKindRef.current = null;
          console.error('InteractiveChart: no suitable series API on chart', chart);
          if (debugRef.current) debugRef.current.textContent = 'no series API';
        }

        seriesRef.current = chartSeries;
        if (chartSeries && debugRef.current) {
          debugRef.current.textContent = `series:${seriesKindRef.current || 'unknown'} ready`;
        }

        const applyInitialData = () => {
          const currentSeries = latestSeriesRef.current;
          if (!seriesRef.current || !currentSeries || !currentSeries.length) return;
          const candleData = currentSeries
            .filter((p) => p && (p.open != null || p.close != null))
            .map((p) => ({
              time: Math.floor((p.ts || p.time || p.t) / 1000),
              open: Number(p.open != null ? p.open : p.price),
              high: Number(p.high != null ? p.high : p.price),
              low: Number(p.low != null ? p.low : p.price),
              close: Number(p.close != null ? p.close : p.price)
            }));
          const lineData = currentSeries
            .filter((p) => p && (p.close != null || p.price != null))
            .map((p) => ({
              time: Math.floor((p.ts || p.time || p.t) / 1000),
              value: Number(p.close != null ? p.close : p.price)
            }));
          const kind = seriesKindRef.current;
          try {
            if (kind === 'candlestick' && candleData.length) {
              seriesRef.current.setData(candleData);
            } else if ((kind === 'area' || kind === 'line') && lineData.length) {
              seriesRef.current.setData(lineData);
            } else if (candleData.length) {
              seriesRef.current.setData(candleData);
            } else if (lineData.length) {
              seriesRef.current.setData(lineData);
            } else {
              seriesRef.current.setData([]);
            }
            try {
              chart.timeScale().fitContent();
            } catch (fitErr) {
              console.debug('InteractiveChart: fitContent during init failed', fitErr);
            }
          } catch (setErr) { console.error('InteractiveChart: setData failed', setErr); }
          if (debugRef.current) {
            debugRef.current.textContent = `series:${seriesKindRef.current || 'none'} candles:${candleData.length} line:${lineData.length}`;
          }
        };

        applyInitialData();

        // resize observer
        try {
          ro = new ResizeObserver(() => {
            if (chartRef.current) chartRef.current.applyOptions({ width: containerEl.clientWidth });
          });
          ro.observe(containerEl);
        } catch (observerErr) {
          console.debug('InteractiveChart: ResizeObserver unavailable', observerErr);
        }

      } catch (err) {
        console.error('InteractiveChart init error', err);
        if (debugRef.current) debugRef.current.textContent = `init error: ${String(err && err.message ? err.message : err)}`;
      }
    }

    initChart();

    return () => {
      try {
        if (ro) ro.disconnect();
      } catch (disconnectErr) {
        console.debug('InteractiveChart: resize observer cleanup failed', disconnectErr);
      }
      try {
        if (chartRef.current) chartRef.current.remove();
      } catch (removeErr) {
        console.debug('InteractiveChart: chart remove during cleanup failed', removeErr);
      }
      chartRef.current = null; seriesRef.current = null; seriesKindRef.current = null;
    };
  }, [height, pct]);

  // update data when series changes
  useEffect(() => {
    try {
      const s = seriesRef.current;
      const chart = chartRef.current;
      if (!s || !chart) return;
      const candleData = series.filter((p) => p && (p.open != null || p.close != null)).map((p) => ({ time: Math.floor((p.ts || p.time || p.t) / 1000), open: Number(p.open != null ? p.open : p.price), high: Number(p.high != null ? p.high : p.price), low: Number(p.low != null ? p.low : p.price), close: Number(p.close != null ? p.close : p.price) }));
      const lineData = series.filter((p) => p && (p.close != null || p.price != null)).map((p) => ({ time: Math.floor((p.ts || p.time || p.t) / 1000), value: Number(p.close != null ? p.close : p.price) }));
      if (typeof s.setData === 'function') {
        const kind = seriesKindRef.current;
        if (kind === 'candlestick' && candleData.length) {
          s.setData(candleData);
        } else if ((kind === 'area' || kind === 'line') && lineData.length) {
          s.setData(lineData);
        } else if (candleData.length) {
          s.setData(candleData);
        } else if (lineData.length) {
          s.setData(lineData);
        } else {
          s.setData([]);
        }
      }
      try {
        if (chart && chart.timeScale) chart.timeScale().fitContent();
      } catch (fitErr) {
        console.debug('InteractiveChart: fitContent during update failed', fitErr);
      }
      try {
        console.debug('InteractiveChart.update data', (lineData && lineData.length ? lineData.slice(0, 5) : candleData && candleData.slice(0, 5)));
      } catch (logErr) {
        console.debug('InteractiveChart: data debug logging failed', logErr);
      }
      if (debugRef.current) {
        debugRef.current.textContent = `update kind:${seriesKindRef.current || 'none'} candles:${candleData.length} line:${lineData.length}`;
      }
    } catch (e) { console.error('InteractiveChart.update error', e); }
  }, [series, pct]);

  const hasData = Array.isArray(series) && series.length > 0;

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div style={{ width: '100%', height }} ref={containerRef} />
      <div ref={debugRef} style={{ position: 'absolute', left: 8, top: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.5)', color: '#cfe9e3', fontSize: 11, borderRadius: 6, pointerEvents: 'none' }} />
      {!hasData && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7780', pointerEvents: 'none' }}>
          <small>No chart data</small>
        </div>
      )}
    </div>
  );
}

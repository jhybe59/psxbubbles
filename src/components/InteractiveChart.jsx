import React, { useEffect, useRef } from 'react';

// Props:
// - series: array of { ts, open, high, low, close, volume }
// - height: px height (optional)
// - pct: percent change (optional) to choose color
export default function InteractiveChart({ series = [], height = 140, pct = 0 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const debugRef = useRef(null);

  // Initialize chart dynamically to avoid bundler alias issues
  useEffect(() => {
    let ro = null;
    let cancelled = false;

    async function initChart() {
      if (!containerRef.current) return;
      try {
        // Prefer a global UMD build if available (we inject it in index.html as a fallback),
        // otherwise import the package normally so Vite can optimize it.
        let mod = null;
        if (typeof window !== 'undefined' && window.LightweightCharts) {
          mod = window.LightweightCharts;
        } else {
          mod = await import('lightweight-charts');
        }
        // show exports for diagnosis
        console.debug('InteractiveChart: lightweight-charts exports', Object.keys(mod));
        if (debugRef.current) debugRef.current.textContent = `lwc exports: ${Object.keys(mod).join(',')}`;

        const createChart = mod.createChart || (mod.default && mod.default.createChart) || (mod.default || null);
        if (typeof createChart !== 'function') {
          console.error('InteractiveChart: createChart not found on module', mod);
          if (debugRef.current) debugRef.current.textContent = 'createChart missing';
          return;
        }

        // remove existing chart if any
        if (chartRef.current) {
          try { chartRef.current.remove(); } catch (e) {}
          chartRef.current = null;
          seriesRef.current = null;
        }

        const chart = createChart(containerRef.current, {
          width: containerRef.current.clientWidth || 400,
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

        // Prefer area series, fall back to line or candle if needed
        let areaSeries = null;
        if (typeof chart.addAreaSeries === 'function') {
          areaSeries = chart.addAreaSeries({ topColor: pct >= 0 ? 'rgba(36,197,94,0.36)' : 'rgba(255,77,77,0.22)', bottomColor: 'rgba(7,16,20,0)', lineColor: pct >= 0 ? '#23c55e' : '#ff6b6b', lineWidth: 2 });
        } else if (typeof chart.addLineSeries === 'function') {
          areaSeries = chart.addLineSeries({ color: pct >= 0 ? '#23c55e' : '#ff6b6b', lineWidth: 2 });
        } else if (typeof chart.addCandlestickSeries === 'function') {
          areaSeries = chart.addCandlestickSeries({ upColor: '#23c55e', downColor: '#ff6b6b' });
        } else {
          console.error('InteractiveChart: no suitable series API on chart', chart);
          if (debugRef.current) debugRef.current.textContent = 'no series API';
        }

        seriesRef.current = areaSeries;

        // set initial data if present
        if (seriesRef.current && series && series.length) {
          // prefer OHLC if available
          const candleData = series.filter((p) => p && (p.open != null || p.close != null)).map((p) => ({ time: Math.floor((p.ts || p.time || p.t) / 1000), open: Number(p.open != null ? p.open : p.price), high: Number(p.high != null ? p.high : p.price), low: Number(p.low != null ? p.low : p.price), close: Number(p.close != null ? p.close : p.price) }));
          const lineData = series.filter((p) => p && (p.close != null || p.price != null)).map((p) => ({ time: Math.floor((p.ts || p.time || p.t) / 1000), value: Number(p.close != null ? p.close : p.price) }));
          try {
            if (candleData && candleData.length && typeof seriesRef.current.setData === 'function') seriesRef.current.setData(candleData);
            else if (lineData && lineData.length && typeof seriesRef.current.setData === 'function') seriesRef.current.setData(lineData);
            try { chart.timeScale().fitContent(); } catch (e) {}
          } catch (e) { console.error('InteractiveChart: setData failed', e); }
        }

        // resize observer
        try {
          ro = new ResizeObserver(() => {
            if (containerRef.current && chartRef.current) chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
          });
          ro.observe(containerRef.current);
        } catch (e) {}

      } catch (err) {
        console.error('InteractiveChart init error', err);
        if (debugRef.current) debugRef.current.textContent = `init error: ${String(err && err.message ? err.message : err)}`;
      }
    }

    initChart();

    return () => {
      cancelled = true;
      try { if (ro && containerRef.current) ro.disconnect(); } catch (e) {}
      try { if (chartRef.current) chartRef.current.remove(); } catch (e) {}
      chartRef.current = null; seriesRef.current = null;
    };
  }, [height]);

  // update data when series changes
  useEffect(() => {
    try {
      const s = seriesRef.current;
      const chart = chartRef.current;
      if (!s || !chart) return;
      const candleData = series.filter((p) => p && (p.open != null || p.close != null)).map((p) => ({ time: Math.floor((p.ts || p.time || p.t) / 1000), open: Number(p.open != null ? p.open : p.price), high: Number(p.high != null ? p.high : p.price), low: Number(p.low != null ? p.low : p.price), close: Number(p.close != null ? p.close : p.price) }));
      const lineData = series.filter((p) => p && (p.close != null || p.price != null)).map((p) => ({ time: Math.floor((p.ts || p.time || p.t) / 1000), value: Number(p.close != null ? p.close : p.price) }));
      if (candleData && candleData.length && typeof s.setData === 'function') s.setData(candleData);
      else if (lineData && lineData.length && typeof s.setData === 'function') s.setData(lineData);
      else if (typeof s.setData === 'function') s.setData([]);
      try { if (chart && chart.timeScale) chart.timeScale().fitContent(); } catch (e) {}
      try { console.debug('InteractiveChart.update data', (lineData && lineData.length ? lineData.slice(0,5) : candleData && candleData.slice(0,5))); } catch (e) {}
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

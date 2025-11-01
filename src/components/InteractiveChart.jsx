import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

// Props:
// - series: array of { ts, open, high, low, close, volume }
// - height: px height (optional)
// - pct: percent change (optional) to choose color
export default function InteractiveChart({ series = [], height = 140, pct = 0 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const lineRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // defensive: initialize chart inside try/catch to avoid blowing up the modal
  try {
      // clean up any existing chart
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch (e) { /* ignore */ }
        chartRef.current = null;
      }

      const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: 'solid', color: '#071014' },
        textColor: '#dfe7e7',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: { visible: true, borderColor: 'rgba(255,255,255,0.04)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.04)' },
    });

      chartRef.current = chart;

    const colorPositive = '#23c55e';
    const colorNegative = '#ff6b6b';
    const color = pct >= 0 ? colorPositive : colorNegative;

    const areaSeries = chart.addAreaSeries({
      topColor: pct >= 0 ? 'rgba(36,197,94,0.36)' : 'rgba(255,77,77,0.22)',
      bottomColor: 'rgba(7,16,20,0)',
      lineColor: color,
      lineWidth: 2,
    });
    lineRef.current = areaSeries;

    function toLineData(s) {
      return (s || []).filter((p) => p && (p.close != null || p.price != null) && Number.isFinite(Number(p.close != null ? p.close : p.price))).map((p) => ({ time: Math.floor(p.ts / 1000), value: Number(p.close != null ? p.close : p.price) }));
    }

    const areaData = toLineData(series || []);
    if (areaData && areaData.length) areaSeries.setData(areaData);
    else areaSeries.setData([]);

    // markers for last/high/low
    if (areaData && areaData.length) {
      const values = areaData.map((d) => d.value);
      const maxVal = Math.max(...values);
      const minVal = Math.min(...values);
      const last = areaData[areaData.length - 1];
      const markers = [];
      const highIndex = areaData.findIndex((d) => d.value === maxVal);
      if (highIndex >= 0) markers.push({ time: areaData[highIndex].time, position: 'aboveBar', color: '#fff', shape: 'circle', text: `H ${maxVal}` });
      const lowIndex = areaData.findIndex((d) => d.value === minVal);
      if (lowIndex >= 0) markers.push({ time: areaData[lowIndex].time, position: 'belowBar', color: '#fff', shape: 'circle', text: `L ${minVal}` });
      markers.push({ time: last.time, position: 'aboveBar', color, shape: 'circle', text: String(last.value) });
      try { areaSeries.setMarkers(markers); } catch (e) { /* ignore */ }
    }

      let resizeObserver = null;
    try {
      resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      resizeObserver.observe(containerRef.current);
    } catch (e) {
      // ResizeObserver may not be available in some envs; ignore
    }

      return () => {
        if (resizeObserver && containerRef.current) resizeObserver.unobserve(containerRef.current);
        if (chartRef.current) {
          try { chartRef.current.remove(); } catch (e) { /* ignore */ }
          chartRef.current = null;
        }
      };
    } catch (err) {
      // If chart initialization fails, log and mark error so we render a fallback
      // eslint-disable-next-line no-console
      console.error('InteractiveChart init error', err);
      // store the error on the container so it's visible in DOM inspector
      if (containerRef.current) containerRef.current.dataset.chartError = String(err && err.message ? err.message : err);
      return () => {};
    }
  }, []); // initialize only once

  // update data when series prop changes
  useEffect(() => {
    // debug: log series size for troubleshooting empty chart
    try {
      // eslint-disable-next-line no-console
      console.debug('InteractiveChart.update series.length=', (series || []).length);
    } catch (e) {}
    if (!lineRef.current || !candleRef.current) return;
    // update area/line
    const areaData = (series || []).filter((p) => p && (p.close != null || p.price != null)).map((p) => ({ time: Math.floor(p.ts / 1000), value: Number(p.close != null ? p.close : p.price) }));
    const candleData = (series || []).filter((p) => p && (p.open != null || p.close != null || p.price != null)).map((p) => ({ time: Math.floor(p.ts / 1000), open: Number(p.open != null ? p.open : (p.price != null ? p.price : p.close)), high: Number(p.high != null ? p.high : (p.price != null ? p.price : p.close)), low: Number(p.low != null ? p.low : (p.price != null ? p.price : p.close)), close: Number(p.close != null ? p.close : (p.price != null ? p.price : p.open)) }));

    if (chartType === 'candles') {
      if (candleData.length) candleRef.current.setData(candleData);
      else candleRef.current.setData([]);
      lineRef.current.setData([]);
    } else {
      if (areaData.length) lineRef.current.setData(areaData);
      else lineRef.current.setData([]);
      candleRef.current.setData([]);
    }

    // update volume if present
    const volData = (series || []).filter((p) => p && (p.volume != null)).map((p) => ({ time: Math.floor(p.ts / 1000), value: Number(p.volume || 0) }));
    if (volumeRef.current) {
      if (volData.length) volumeRef.current.setData(volData);
      else volumeRef.current.setData([]);
    }

    // markers on active representation
    try {
      const markerSrc = areaData.length ? areaData : candleData.map((c) => ({ time: c.time, value: c.close }));
      if (markerSrc && markerSrc.length) {
        const values = markerSrc.map((d) => d.value != null ? d.value : d.close).filter((v) => v != null);
        if (values.length) {
          const maxVal = Math.max(...values);
          const minVal = Math.min(...values);
          const last = markerSrc[markerSrc.length - 1];
          const markers = [];
          const highIndex = markerSrc.findIndex((d) => (d.value != null ? d.value : d.close) === maxVal);
          if (highIndex >= 0) markers.push({ time: markerSrc[highIndex].time, position: 'aboveBar', color: '#fff', shape: 'circle', text: `H ${maxVal}` });
          const lowIndex = markerSrc.findIndex((d) => (d.value != null ? d.value : d.close) === minVal);
          if (lowIndex >= 0) markers.push({ time: markerSrc[lowIndex].time, position: 'belowBar', color: '#fff', shape: 'circle', text: `L ${minVal}` });
          markers.push({ time: last.time, position: 'aboveBar', color: pct >= 0 ? '#23c55e' : '#ff6b6b', shape: 'circle', text: String((last.value != null) ? last.value : (last.close != null ? last.close : '')) });
          lineRef.current.setMarkers(markers);
        }
      } else {
        lineRef.current.setMarkers([]);
      }
    } catch (e) {
      // ignore marker errors
    }
  }, [series, pct]);

  const hasData = (series || []).length > 0;
  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div style={{ width: '100%', height }} ref={containerRef} />
      {!hasData && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7780', pointerEvents: 'none' }}>
          <small>No chart data</small>
        </div>
      )}
    </div>
  );
}

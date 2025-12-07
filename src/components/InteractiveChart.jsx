import React, { useEffect, useRef } from 'react';

// Props:
// - series: array of { ts, open, high, low, close, volume }
// - height: px height (optional)
// - pct: percent change (optional) to choose color


// Props:
// - series: array of { ts, open, high, low, close, volume }
// - type: 'area' | 'candle'
// - height: px height (optional)
// - pct: percent change (optional) to choose color
export default function InteractiveChart({ series = [], type = 'area', height = 320, pct = 0 }) {
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

        const createChart = lwc?.createChart;
        if (typeof createChart !== 'function') return;

        // remove existing chart if any
        if (chartRef.current) {
          try {
            chartRef.current.remove();
          } catch (removeErr) { console.debug(removeErr); }
          chartRef.current = null;
          seriesRef.current = null;
          seriesKindRef.current = null;
        }

        // Premium Chart Layout
        const chart = createChart(containerEl, {
          width: containerEl.clientWidth || 400,
          height,
          layout: {
            background: { type: 'solid', color: 'transparent' }, // Use transparent to blend with modal
            textColor: '#94a3b8',
            fontFamily: "'Inter', sans-serif",
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.02)' },
            horzLines: { color: 'rgba(255,255,255,0.02)' }
          },
          crosshair: {
            mode: 1, // CrosshairMode.Magnet
            vertLine: {
              width: 1,
              color: 'rgba(255, 255, 255, 0.4)',
              style: 3, // LineStyle.Dashed
              labelBackgroundColor: '#1e293b',
            },
            horzLine: {
              width: 1,
              color: 'rgba(255, 255, 255, 0.4)',
              style: 3,
              labelBackgroundColor: '#1e293b',
            },
          },
          rightPriceScale: {
            visible: true,
            borderColor: 'rgba(255,255,255,0.05)',
            textColor: '#64748b',
          },
          timeScale: {
            visible: true,
            borderColor: 'rgba(255,255,255,0.05)',
            timeVisible: true,
            secondsVisible: false,
          },
          handleScale: {
            axisPressedMouseMove: true,
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
          },
        });
        chartRef.current = chart;

        const isPositive = pct >= 0;
        const mainColor = isPositive ? '#22c55e' : '#ef4444';

        let chartSeries = null;

        // Create Series based on Type
        if (type === 'candle') {
          // CANDLESTICK
          if (typeof chart.addCandlestickSeries === 'function') {
            chartSeries = chart.addCandlestickSeries({
              upColor: '#22c55e',
              downColor: '#ef4444',
              borderVisible: false,
              wickUpColor: '#22c55e',
              wickDownColor: '#ef4444',
            });
            seriesKindRef.current = 'candlestick';
          }
        } else {
          // AREA (Default)
          if (typeof chart.addAreaSeries === 'function') {
            chartSeries = chart.addAreaSeries({
              topColor: isPositive ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)',
              bottomColor: isPositive ? 'rgba(34, 197, 94, 0.0)' : 'rgba(239, 68, 68, 0.0)',
              lineColor: mainColor,
              lineWidth: 2,
            });
            seriesKindRef.current = 'area';
          }
        }

        if (!chartSeries) {
          console.error('InteractiveChart: failed to create series');
          return;
        }

        seriesRef.current = chartSeries;

        // Populate Data
        const applyInitialData = () => {
          const currentSeries = latestSeriesRef.current;
          if (!seriesRef.current || !currentSeries || !currentSeries.length) return;

          const kind = seriesKindRef.current;

          try {
            // Map data
            let data = [];
            if (kind === 'candlestick') {
              data = currentSeries
                .filter(p => p && (p.open != null || p.close != null))
                .map(p => ({
                  time: Math.floor((p.ts || p.time || p.t) / 1000),
                  open: Number(p.open ?? p.price),
                  high: Number(p.high ?? p.price),
                  low: Number(p.low ?? p.price),
                  close: Number(p.close ?? p.price)
                }))
                // Deduplicate and Sort
                .sort((a, b) => a.time - b.time);
            } else {
              data = currentSeries
                .filter(p => p && (p.close != null || p.price != null))
                .map(p => ({
                  time: Math.floor((p.ts || p.time || p.t) / 1000),
                  value: Number(p.close ?? p.price)
                }))
                .sort((a, b) => a.time - b.time);
            }

            // Uniqueness check for time
            const unique = [];
            let lastT = null;
            for (const item of data) {
              if (item.time !== lastT) {
                unique.push(item);
                lastT = item.time;
              }
            }

            seriesRef.current.setData(unique);
            chart.timeScale().fitContent();
          } catch (setErr) { console.error('InteractiveChart: setData failed', setErr); }
        };

        applyInitialData();

        // Resize Observer
        try {
          ro = new ResizeObserver(() => {
            if (chartRef.current) chartRef.current.applyOptions({ width: containerEl.clientWidth, height: containerEl.clientHeight });
          });
          ro.observe(containerEl);
        } catch (e) {
          // ignore
        }

      } catch (err) {
        console.error('InteractiveChart init error', err);
      }
    }

    initChart();

    return () => {
      try { if (ro) ro.disconnect(); } catch (e) { }
      try { if (chartRef.current) chartRef.current.remove(); } catch (e) { }
      chartRef.current = null; seriesRef.current = null;
    };
  }, [height, pct, type]); // Re-init when TYPE changes

  // Update data effect
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;

    const kind = seriesKindRef.current;
    if (kind === 'candlestick' && type !== 'candle') return; // mismatch wait for re-init
    if (kind === 'area' && type === 'candle') return; // mismatch wait for re-init

    // Same data mapping logic as init
    let data = [];
    if (kind === 'candlestick') {
      data = series.map(p => ({
        time: Math.floor((p.ts || p.time || p.t) / 1000),
        open: Number(p.open ?? p.price),
        high: Number(p.high ?? p.price),
        low: Number(p.low ?? p.price),
        close: Number(p.close ?? p.price)
      })).sort((a, b) => a.time - b.time);
    } else {
      data = series.map(p => ({
        time: Math.floor((p.ts || p.time || p.t) / 1000),
        value: Number(p.close ?? p.price)
      })).sort((a, b) => a.time - b.time);
    }

    const unique = [];
    let lastT = null;
    for (const item of data) {
      if (item.time !== lastT) {
        unique.push(item);
        lastT = item.time;
      }
    }

    try {
      seriesRef.current.setData(unique);
    } catch (e) { console.error(e); }

  }, [series]);

  const hasData = Array.isArray(series) && series.length > 0;

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div style={{ width: '100%', height }} ref={containerRef} />
      {!hasData && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7780', pointerEvents: 'none' }}>
          {/* Optional Loading or Empty State */}
        </div>
      )}
    </div>
  );
}

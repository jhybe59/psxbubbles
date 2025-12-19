import React, { useEffect, useState, useRef } from 'react';
import EmbeddedChart from './EmbeddedChart';
import { LIVE_API_BASE_URL, LIVE_API_KEY, ENABLE_LIVE_API } from '../config';
import storage from '../lib/storage';
import { buildCandlesFromSnapshots } from '../lib/chartUtils';
import { getCandleType } from '../lib/indicators';

export default function QuickChart({ symbol, interval, x, y, onClose, currentPrice }) {
    const [series, setSeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef(null);
    // ... (mapInterval code)

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

    // Map bubble interval to chart interval
    const mapInterval = (int) => {
        const mapping = {
            '1 Min': '1m', '5 Min': '5m', '15 Min': '15m', 'Hour': '1h',
            'Day': 'Day', 'Week': 'Week', 'Month': 'Month', 'Year': 'Year',
            '10 Ticks': '10T', '100 Ticks': '100T', '500 Ticks': '500T', '1000 Ticks': '1000T'
        };
        return mapping[int] || '1h';
    };

    const chartInterval = mapInterval(interval);

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
                    const json = await res.json();
                    if (mounted && json.data) {
                        setSeries(json.data.map(d => ({
                            ts: new Date(d.ts).getTime(),
                            open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume
                        })));
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
                    if (res.ok) {
                        const json = await res.json();
                        if (mounted && json.data) {
                            setSeries(json.data.map(d => ({
                                ts: new Date(d.ts).getTime(),
                                open: Number(d.open), high: Number(d.high), low: Number(d.low), close: Number(d.close), volume: Number(d.volume)
                            })).sort((a, b) => a.ts - b.ts));
                        }
                    }
                }
            } catch (err) {
                console.error("QuickChart fetch error", err);
            } finally {
                if (mounted && !isPolling) setLoading(false);
            }
        }

        fetchData();

        // Poll every 15 seconds
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

    // Adjust position to stay on screen
    const width = 600;
    const height = 400;

    // Ensure it doesn't go off screen
    let finalX = x;
    let finalY = y;

    if (typeof window !== 'undefined') {
        if (finalX + width > window.innerWidth) finalX = window.innerWidth - width - 10;
        if (finalY + height > window.innerHeight) finalY = window.innerHeight - height - 10;
    }

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                left: finalX,
                top: finalY,
                width: width,
                height: height,
                zIndex: 10001, // Above tooltip (10000)
                background: '#131722',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
                border: '1px solid #334155',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
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
                color: '#94a3b8'
            }}>
                <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{symbol} • {chartInterval}</span>
                <span style={{ fontSize: '10px' }}>Right-Click Chart</span>
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
                {loading ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                        Loading...
                    </div>
                ) : (
                    <EmbeddedChart
                        data={series}
                        symbol={symbol}
                        height={height - 28} // Subtract header height
                        candleType={getCandleType()}
                    // Re-use same indicators from default profile
                    />
                )}
            </div>
        </div>
    );
}

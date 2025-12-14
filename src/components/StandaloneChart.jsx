import React, { useEffect, useState, useRef } from 'react';
import AdvancedChart from './AdvancedChart';
import { LIVE_API_BASE_URL, LIVE_API_KEY, ENABLE_LIVE_API } from '../config';

export default function StandaloneChart() {
    const [symbol, setSymbol] = useState(null);
    const [series, setSeries] = useState([]);
    const [timeframe, setTimeframe] = useState('15m'); // Default interval
    const [chartType, setChartType] = useState('Candles');
    const [candleType, setCandleType] = useState('Candles');

    useEffect(() => {
        // Extract symbol from URL path: /chart/:symbol
        // Assumes path is like /chart/BTC
        const path = window.location.pathname;
        const parts = path.split('/');
        const sym = parts[parts.length - 1]; // Simply take the last part for now
        if (sym && sym !== 'chart') {
            setSymbol(decodeURIComponent(sym));
        }

        // Read interval and chartType from query params
        const urlParams = new URLSearchParams(window.location.search);
        const interval = urlParams.get('interval');
        const type = urlParams.get('type');

        if (interval) {
            setTimeframe(decodeURIComponent(interval));
        }
        if (type) {
            setChartType(decodeURIComponent(type));
        }

        const cType = urlParams.get('candleType');
        if (cType) {
            setCandleType(decodeURIComponent(cType));
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        async function loadSeries() {
            if (!symbol) return;
            console.log('[StandaloneChart] Loading series for', symbol, timeframe);

            try {
                const isTick = timeframe.includes('Tick');
                const origin = window.location.origin;
                const base = LIVE_API_BASE_URL.startsWith('http') ? LIVE_API_BASE_URL : `${origin}${LIVE_API_BASE_URL.startsWith('/') ? '' : '/'}${LIVE_API_BASE_URL}`;

                let url;
                if (isTick) {
                    url = new URL('tick-candles', base.endsWith('/') ? base : `${base}/`);
                    const intervalCode = timeframe.replace(' Ticks', 'T').replace(' ', ''); // 100 Ticks -> 100T
                    url.searchParams.set('interval', intervalCode);
                    url.searchParams.set('limit', '100');
                } else {
                    url = new URL('candles', base.endsWith('/') ? base : `${base}/`);
                    url.searchParams.set('interval', timeframe);
                    url.searchParams.set('limit', '500');
                }

                url.searchParams.set('symbol', symbol);

                const headers = { 'Content-Type': 'application/json' };
                if (LIVE_API_KEY) headers['x-api-key'] = LIVE_API_KEY;

                console.log('[StandaloneChart] Fetching from:', url.toString());
                const res = await fetch(url.toString(), { headers });

                if (res.ok) {
                    const json = await res.json();
                    if (mounted && json.data) {
                        const s = json.data.map(d => ({
                            ts: new Date(d.ts).getTime(),
                            open: Number(d.open),
                            high: Number(d.high),
                            low: Number(d.low),
                            close: Number(d.close),
                            volume: Number(d.volume) || 0
                        }));

                        // Ticks from `tick-candles` are oldest->newest, same for `candles`
                        // Ensure sort provided just in case
                        s.sort((a, b) => a.ts - b.ts);

                        setSeries(s);
                    }
                } else {
                    console.error('[StandaloneChart] API Error:', res.status);
                }
            } catch (err) {
                console.error('[StandaloneChart] Fetch error:', err);
            }
        }

        loadSeries();
        const interval = setInterval(loadSeries, 10000); // Poll every 10s
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [symbol, timeframe]);

    if (!symbol) return <div style={{ color: '#fff', padding: 20 }}>Loading or Invalid Symbol...</div>;

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#131722', display: 'flex', flexDirection: 'column' }}>
            <AdvancedChart
                data={series}
                symbol={symbol}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                chartType={chartType}
                setChartType={setChartType}
                candleType={candleType}
                setCandleType={setCandleType}
                onClose={() => window.close()} // Close tab
            />
        </div>
    );
}

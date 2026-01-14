// Node 24 has built-in fetch
const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function analyzeWithRefinedLogic(symbol, today) {
    const sql = `
        SELECT 
            timestamp,
            first(price) as open,
            max(price) as high,
            min(price) as low,
            last(price) as close,
            sum(volume) as volume
        FROM trades
        WHERE symbol = '${symbol}' AND timestamp >= '${today}'
        SAMPLE BY 5m
        ORDER BY timestamp
    `;
    const res = await query(sql);
    if (!res.dataset || res.dataset.length < 20) return null;

    const data = res.dataset.map(b => ({
        ts: b[0],
        time: new Date(b[0]).toLocaleTimeString('en-US', { hour12: false }),
        open: b[1],
        high: b[2],
        low: b[3],
        close: b[4],
        volume: b[5]
    }));

    const orb5mHigh = data[0].high;
    const avgVolPeriod = 20;

    let squeezeBars = 0;
    const signals = [];
    let sessionHigh = orb5mHigh;

    for (let i = avgVolPeriod; i < data.length; i++) {
        const d = data[i];
        const prev = data[i - 1];

        // Dynamic RVOL vs last 20 bars
        const window = data.slice(i - avgVolPeriod, i);
        const rollingAvgVol = window.reduce((s, b) => s + b.volume, 0) / avgVolPeriod;
        const rvol = rollingAvgVol > 0 ? d.volume / rollingAvgVol : 1;

        // TTM Squeeze Proxy (Tightness)
        const range = (d.high - d.low) / d.open;
        if (range < 0.004) squeezeBars++;
        else squeezeBars = Math.max(0, squeezeBars - 0.5);

        const bodyPct = (Math.abs(d.close - d.open) / Math.max(0.001, d.high - d.low)) * 100;

        const isBreaking = d.close > sessionHigh && prev.close <= sessionHigh;
        const hasMomentum = d.close > d.open && (bodyPct > 50);
        const hasVolume = rvol > 2.5;
        const wasConsolidated = squeezeBars >= 3;

        if (symbol === 'YOUW' && d.time.includes('13:45')) {
            console.log(`\n[DEBUG YOUW 13:45]`);
            console.log(`Price: ${d.open} -> ${d.close} (H:${d.high}, L:${d.low})`);
            console.log(`SessionHigh: ${sessionHigh}`);
            console.log(`isBreaking: ${isBreaking}`);
            console.log(`rvol: ${rvol.toFixed(1)} (Avg: ${rollingAvgVol.toFixed(0)}, Cur: ${d.volume})`);
            console.log(`bodyPct: ${bodyPct.toFixed(0)}%`);
            console.log(`squeezeBars: ${squeezeBars}`);
            console.log(`hasMomentum: ${hasMomentum}, hasVolume: ${hasVolume}, wasConsolidated: ${wasConsolidated}`);
        }

        if (isBreaking && hasMomentum && hasVolume && wasConsolidated) {
            signals.push({
                time: d.time,
                price: d.close,
                rvol,
                bodyPct,
                squeezeBars
            });
        }

        if (d.high > sessionHigh) sessionHigh = d.high;
    }

    return signals.length > 0 ? signals : null;
}

async function main() {
    const today = new Date().toISOString().split('T')[0];
    const topSymbolsSQL = `
        SELECT symbol, sum(volume) as v
        FROM trades
        WHERE timestamp >= '${today}'
        GROUP BY symbol
        ORDER BY v DESC
        LIMIT 50
    `;
    const symbolsResult = await query(topSymbolsSQL);
    const symbols = symbolsResult.dataset.map(r => r[0]);

    if (!symbols.includes('YOUW')) symbols.push('YOUW');

    console.log(`Analyzing ${symbols.length} symbols with Refined Logic (DEBUG)...\n`);

    for (const symbol of symbols) {
        const signals = await analyzeWithRefinedLogic(symbol, today);
        if (signals) {
            console.log(`🚀 SIGNAL: ${symbol}`);
            signals.forEach(s => {
                console.log(`   ${s.time} | Price: ${s.price.toFixed(2)} | RVOL: ${s.rvol.toFixed(1)}x | Body: ${s.bodyPct.toFixed(0)}% | Squeeze: ${s.squeezeBars} bars`);
            });
        }
    }
}

main().catch(console.error);

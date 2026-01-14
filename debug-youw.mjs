// Node 24 has built-in fetch
const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function debugSymbol(symbol) {
    const today = new Date().toISOString().split('T')[0];
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
    if (!res.dataset) return;

    const data = res.dataset.map(b => ({
        ts: b[0],
        time: new Date(b[0]).toLocaleTimeString('en-US', { hour12: false }),
        open: b[1],
        high: b[2],
        low: b[3],
        close: b[4],
        volume: b[5]
    }));

    const avgVolPeriod = 20;
    let squeezeBars = 0;
    let sessionHigh = data[0].high;

    console.log(`Time\tPrice\tBody\tRVOL\tSqueeze\tBreak?`);
    console.log(`-----------------------------------------------`);

    for (let i = 0; i < data.length; i++) {
        const d = data[i];
        const prev = i > 0 ? data[i - 1] : d;

        // Dynamic RVOL
        const startIdx = Math.max(0, i - avgVolPeriod);
        const window = data.slice(startIdx, i);
        const rollingAvgVol = window.length > 0 ? window.reduce((s, b) => s + b.volume, 0) / window.length : d.volume;
        const rvol = rollingAvgVol > 0 ? d.volume / rollingAvgVol : 1;

        // Squeeze
        const range = (d.high - d.low) / d.open;
        if (range < 0.004) squeezeBars++;
        else squeezeBars = Math.max(0, squeezeBars - 0.5);

        const bodyPct = (Math.abs(d.close - d.open) / Math.max(0.001, d.high - d.low)) * 100;
        const isBreaking = d.close > sessionHigh;

        if (d.time.includes('10:4') || d.time.includes('13:4') || d.time.includes('13:5')) {
            console.log(`${d.time}\t${d.close.toFixed(2)}\t${bodyPct.toFixed(0)}%\t${rvol.toFixed(1)}x\t${squeezeBars.toFixed(1)}\t${isBreaking ? 'YES' : 'no'}`);
        }

        if (d.high > sessionHigh) sessionHigh = d.high;
    }
}

debugSymbol('YOUW').catch(console.error);

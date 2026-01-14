// Node 24 has built-in fetch
const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function debugYOUW(today) {
    const symbol = 'YOUW';
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
    const data = res.dataset.map(b => ({
        ts: b[0],
        time: new Date(b[0]).toLocaleTimeString('en-US', { hour12: false }),
        open: b[1],
        high: b[2],
        low: b[3],
        close: b[4],
        volume: b[5]
    }));

    let sessionHigh = data[0].high;
    console.log("Time\tPrice\tTight\tVolP\tProx\tBull\tHigh");

    for (let i = 5; i < data.length; i++) {
        const d = data[i];
        const prevBars = data.slice(i - 4, i);

        const avgRange = prevBars.reduce((s, b) => s + (b.high - b.low) / b.open, 0) / prevBars.length;
        const avgVolPre = prevBars.reduce((s, b) => s + b.volume, 0) / prevBars.length;
        const volPulse = avgVolPre > 0 ? d.volume / avgVolPre : 1;
        const proximity = (sessionHigh - d.close) / sessionHigh;
        const bullishBars = prevBars.filter(b => b.close >= b.open).length;

        if (d.time.includes("13:3") || d.time.includes("13:4")) {
            console.log(`${d.time}\t${d.close.toFixed(2)}\t${(avgRange * 100).toFixed(2)}%\t${volPulse.toFixed(1)}x\t${(proximity * 100).toFixed(2)}%\t${bullishBars}\t${sessionHigh.toFixed(2)}`);
        }

        if (d.high > sessionHigh) sessionHigh = d.high;
    }
}

debugYOUW(new Date().toISOString().split('T')[0]).catch(console.error);

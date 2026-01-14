// Node 24 has built-in fetch
const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function extractSignature(symbol, today) {
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
    if (!res.dataset || res.dataset.length < 15) return null;

    const data = res.dataset.map(b => ({
        ts: b[0],
        time: new Date(b[0]).toLocaleTimeString('en-US', { hour12: false }),
        open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5]
    }));

    let sessionHigh = data[0].high;
    const pulses = [];

    for (let i = 5; i < data.length; i++) {
        const d = data[i];
        const prevBars = data.slice(i - 4, i);
        const avgVolPre = prevBars.reduce((s, b) => s + b.volume, 0) / prevBars.length;
        const volPulse = avgVolPre > 0 ? d.volume / avgVolPre : 1;
        const range = (d.high - d.low) / d.open;
        const avgRange = prevBars.reduce((s, b) => s + (b.high - b.low) / b.open, 0) / prevBars.length;
        const prox = (sessionHigh - d.close) / sessionHigh;

        // If it's a breakout or a significant volume pulse at high
        if ((d.close > sessionHigh || volPulse > 5) && d.close > d.open) {
            pulses.push({
                time: d.time,
                price: d.close,
                volPulse: volPulse.toFixed(1) + 'x',
                tightness: (avgRange * 100).toFixed(2) + '%',
                proximity: (prox * 100).toFixed(2) + '%',
                isBO: d.close > sessionHigh
            });
        }
        if (d.high > sessionHigh) sessionHigh = d.high;
    }

    return pulses;
}

async function main() {
    const symbols = ['BFMOD', 'CTM', 'UCAPM', 'SGPL', 'FECTC', 'SAZEW', 'TELE', 'OBOY'];
    const today = new Date().toISOString().split('T')[0];

    console.log("Detailed Signature Analysis (Pre-Breakout Pulses):\n");

    for (const sym of symbols) {
        const sigs = await extractSignature(sym, today);
        if (sigs && sigs.length > 0) {
            console.log(`\n--- ${sym} ---`);
            console.log("Time\tPrice\tVolP\tTight\tProx\tType");
            sigs.forEach(s => {
                console.log(`${s.time}\t${s.price.toFixed(2)}\t${s.volPulse}\t${s.tightness}\t${s.proximity}\t${s.isBO ? 'BO' : 'PULSE'}`);
            });
        }
    }
}

main().catch(console.error);

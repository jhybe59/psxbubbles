// Node 24 has built-in fetch
const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function analyzeZeroFakeout(symbol, today) {
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
        SAMPLE BY 1m -- Using 1m for ultra-precision
        ORDER BY timestamp
    `;
    const res = await query(sql);
    if (!res.dataset || res.dataset.length < 30) return null;

    const data = res.dataset.map(b => ({
        ts: b[0],
        time: new Date(b[0]).toLocaleTimeString('en-US', { hour12: false }),
        open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5]
    }));

    let sessionHigh = data[0].high;
    const signals = [];

    for (let i = 20; i < data.length; i++) {
        const d = data[i];

        // 1. TIGHTNESS FILTER (Last 15 minutes)
        const window15m = data.slice(i - 15, i);
        const range15m = (Math.max(...window15m.map(b => b.high)) - Math.min(...window15m.map(b => b.low))) / d.open;
        const isTight = range15m < 0.005; // Extremely flat consolidation

        // 2. VOLUME PULSE (Last 1 minute vs previous 15 mins)
        const avgVol15m = window15m.reduce((s, b) => s + b.volume, 0) / 15;
        const volPulse = avgVol15m > 0 ? d.volume / avgVol15m : 1;

        // 3. ZERO-FAKEOUT FILTERS (Anti-Trap)
        const proximity = (sessionHigh - d.close) / sessionHigh;
        const isHugging = proximity < 0.002 && proximity >= 0; // Price MUST be at the very top of range but not broken yet
        const noUpperWick = (d.high - d.close) / (d.high - d.low || 1) < 0.3; // Candle must close near high (no rejection)

        // THE TRIGGER (PRE-BREAKOUT)
        if (isTight && volPulse > 15 && isHugging && noUpperWick) {
            signals.push({
                time: d.time,
                price: d.close,
                volPulse: volPulse.toFixed(1) + 'x',
                range: (range15m * 100).toFixed(2) + '%'
            });
            // Cooldown 15m
            i += 15;
        }

        if (d.high > sessionHigh) sessionHigh = d.high;
    }

    return signals.length > 0 ? signals : null;
}

async function main() {
    const today = new Date().toISOString().split('T')[0];
    const topSymbolsSQL = `SELECT symbol FROM (SELECT symbol, count() as c FROM trades WHERE timestamp >= '${today}' GROUP BY symbol) WHERE c > 500 LIMIT 100`;
    const symbolsRes = await query(topSymbolsSQL);
    const symbols = symbolsRes.dataset.map(r => r[0]);

    console.log(`TESTING ZERO-FAAKEOUT LOGIC (1m Precision) on ${symbols.length} symbols...\n`);
    console.log("Symbol\tLead Time\tPrice\tPulse\tTightness");
    console.log("----------------------------------------------------------------------");

    for (const sym of symbols) {
        const t = await analyzeZeroFakeout(sym, today);
        if (t) {
            t.forEach(s => console.log(`${sym}\t${s.time}\t${s.price.toFixed(2)}\t${s.volPulse}\t${s.range}`));
        }
    }
}

main().catch(console.error);

// Node 24 has built-in fetch
const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function analyzePatterns(symbol, today) {
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
    if (!res.dataset) return null;

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
    let sessionHigh = orb5mHigh;
    let boIdx = -1;

    // Find the REAL breakout (significant move above session high)
    for (let i = 1; i < data.length; i++) {
        const d = data[i];
        if (d.close > sessionHigh && (d.close - data[i - 1].close) / data[i - 1].close > 0.005) {
            boIdx = i;
            break;
        }
        if (d.high > sessionHigh) sessionHigh = d.high;
    }

    if (boIdx === -1) return null;

    // Analyze Pre-Breakout (4 bars before)
    const pre = data.slice(Math.max(0, boIdx - 4), boIdx);
    if (pre.length < 2) return null;

    const volTrend = pre[pre.length - 1].volume / (pre[0].volume || 1);
    const avgRange = pre.reduce((s, b) => s + (b.high - b.low) / b.open, 0) / pre.length;
    const proximity = (sessionHigh - pre[pre.length - 1].close) / sessionHigh;

    return {
        symbol,
        boTime: data[boIdx].time,
        volTrend: volTrend.toFixed(1) + 'x',
        avgRange: (avgRange * 100).toFixed(2) + '%',
        proximity: (proximity * 100).toFixed(2) + '%',
        preVol: pre.map(b => Math.round(b.volume / 1000) + 'k').join('->')
    };
}

async function main() {
    const symbols = ['ZAL', 'IBLHL', 'NRL', 'QUICE', 'UCAPM', 'BFMOD', 'FECTC', 'YOUW', 'SAZEW', 'SGPL', 'HUBC'];
    const today = new Date().toISOString().split('T')[0];

    console.log("Analyzing Pre-Breakout Patterns for Day's Winners...\n");
    console.log("Symbol\tBO Time\tVolTrend\tAvgRange\tProximity\tPre-Move Volume Pulse");
    console.log("---------------------------------------------------------------------------------------------");

    for (const sym of symbols) {
        const result = await analyzePatterns(sym, today);
        if (result) {
            console.log(`${result.symbol}\t${result.boTime}\t${result.volTrend}\t\t${result.avgRange}\t\t${result.proximity}\t\t${result.preVol}`);
        }
    }
}

main().catch(console.error);

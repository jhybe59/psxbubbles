// Node 24 has built-in fetch
const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function analyzeFakeout(symbol, today) {
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
    let crossTime = -1;

    for (let i = 1; i < data.length; i++) {
        if (data[i].high > orb5mHigh) {
            crossTime = i;
            break;
        }
    }

    if (crossTime === -1) return null;

    // Analyze 4 bars before
    const pre = data.slice(Math.max(0, crossTime - 4), crossTime);
    if (pre.length < 2) return null;

    const volTrend = pre[pre.length - 1].volume / (pre[0].volume || 1);
    const avgRange = pre.reduce((s, b) => s + (b.high - b.low) / b.open, 0) / pre.length;
    const proximity = (orb5mHigh - pre[pre.length - 1].close) / orb5mHigh;

    return {
        symbol,
        crossTime: data[crossTime].time,
        volTrend: volTrend.toFixed(1) + 'x',
        avgRange: (avgRange * 100).toFixed(2) + '%',
        proximity: (proximity * 100).toFixed(2) + '%',
        endGain: ((data[data.length - 1].close - data[0].open) / data[0].open * 100).toFixed(2) + '%'
    };
}

async function main() {
    const today = new Date().toISOString().split('T')[0];

    // Symbols that crossed ORB High but ended poorly (< 1% gain from open)
    const sql = `
        SELECT symbol
        FROM trades
        WHERE timestamp >= '${today}'
        GROUP BY symbol
        HAVING (last(price) - first(price)) / first(price) < 0.01 
           AND max(price) / first(price) > 1.01 -- At some point was up > 1%
        LIMIT 20
    `;
    const res = await query(sql);
    if (!res.dataset) return;

    const symbols = res.dataset.map(r => r[0]);

    console.log("Analyzing Fakeouts (Broke High but Failed)...\n");
    console.log("Symbol\tCrossTime\tVolTrend\tAvgRange\tProximity\tFinal Gain");
    console.log("----------------------------------------------------------------------------------");

    for (const sym of symbols) {
        const result = await analyzeFakeout(sym, today);
        if (result) {
            console.log(`${result.symbol}\t${result.crossTime}\t${result.volTrend}\t\t${result.avgRange}\t\t${result.proximity}\t\t${result.endGain}`);
        }
    }
}

main().catch(console.error);

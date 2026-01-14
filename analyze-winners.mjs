// Node 24 has built-in fetch
const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function analyzePreBreakout(symbol, today) {
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
    if (!res.dataset || res.dataset.length < 10) return null;

    const data = res.dataset.map(b => ({
        ts: b[0],
        time: new Date(b[0]).toLocaleTimeString('en-US', { hour12: false }),
        open: b[1],
        high: b[2],
        low: b[3],
        close: b[4],
        volume: b[5]
    }));

    // Find the move start (first time price jumped > 1% in a bar or crossed session high with volume)
    let moveStartIdx = -1;
    let sessionHigh = data[0].high;
    const orb5mHigh = data[0].high;

    for (let i = 1; i < data.length; i++) {
        const d = data[i];
        const prev = data[i - 1];
        const jump = (d.close - prev.close) / prev.close;

        if (d.close > sessionHigh && jump > 0.005) {
            moveStartIdx = i;
            break;
        }
        if (d.high > sessionHigh) sessionHigh = d.high;
    }

    if (moveStartIdx === -1) return null;

    // Analyze 6 bars (30 mins) BEFORE the moveStartIdx
    const prePhaseStart = Math.max(0, moveStartIdx - 6);
    const prePhase = data.slice(prePhaseStart, moveStartIdx);

    // Metrics in pre-phase
    const avgVolumePre = prePhase.reduce((s, b) => s + b.volume, 0) / (prePhase.length || 1);
    const maxRangePre = Math.max(...prePhase.map(b => (b.high - b.low) / b.open)) * 100;
    const volumeBuild = prePhase.length >= 2 ? prePhase[prePhase.length - 1].volume / (prePhase[0].volume || 1) : 1;
    const proximityToHigh = (sessionHigh - prePhase[prePhase.length - 1].close) / sessionHigh * 100;

    return {
        symbol,
        moveTime: data[moveStartIdx].time,
        movePrice: data[moveStartIdx].close,
        avgVolPre: avgVolumePre.toFixed(0),
        maxRangePre: maxRangePre.toFixed(2) + '%',
        volBuild: volumeBuild.toFixed(1) + 'x',
        prox: proximityToHigh.toFixed(2) + '%'
    };
}

async function main() {
    const today = new Date().toISOString().split('T')[0];

    // 1. Get ALL symbols with > 2.5% gain from open today
    const winnersSQL = `
        SELECT symbol, first(price) as o, last(price) as c
        FROM trades
        WHERE timestamp >= '${today}'
        GROUP BY symbol
        HAVING (last(price) - first(price)) / first(price) > 0.025
        ORDER BY (last(price) - first(price)) / first(price) DESC
    `;
    const winnersRes = await query(winnersSQL);
    if (!winnersRes.dataset) return console.log("No winners found.");

    const winners = winnersRes.dataset.map(r => r[0]);
    console.log(`Found ${winners.length} movers (>2.5%). Analyzing Pre-Breakout patterns...\n`);

    const analysis = [];
    for (const symbol of winners) {
        const result = await analyzePreBreakout(symbol, today);
        if (result) analysis.push(result);
    }

    console.log(`Symbol\tTime\tPrice\tAvgVolPre\tRangePre\tVolBuild\tProxHigh`);
    console.log(`-------------------------------------------------------------------------`);
    analysis.forEach(a => {
        console.log(`${a.symbol}\t${a.moveTime}\t${a.movePrice.toFixed(2)}\t${a.avgVolPre}\t\t${a.maxRangePre}\t\t${a.volBuild}\t\t${a.prox}`);
    });
}

main().catch(console.error);

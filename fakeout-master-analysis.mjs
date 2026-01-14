// Node 24 has built-in fetch
const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function analyzeAllFakeouts(today) {
    const symbolsSQL = `SELECT symbol FROM (SELECT symbol, count() as c FROM trades WHERE timestamp >= '${today}' GROUP BY symbol) WHERE c > 100`;
    const symbolsRes = await query(symbolsSQL);
    const symbols = symbolsRes.dataset.map(r => r[0]);

    console.log(`Analyzing ${symbols.length} symbols for Fakeout patterns...\n`);

    const findings = [];

    for (const sym of symbols) {
        const sql = `
            SELECT 
                timestamp,
                first(price) as open,
                max(price) as high,
                min(price) as low,
                last(price) as close,
                sum(volume) as volume
            FROM trades
            WHERE symbol = '${sym}' AND timestamp >= '${today}'
            SAMPLE BY 5m
            ORDER BY timestamp
        `;
        const res = await query(sql);
        if (!res.dataset || res.dataset.length < 15) continue;

        const data = res.dataset.map(b => ({
            ts: b[0],
            time: new Date(b[0]).toLocaleTimeString('en-US', { hour12: false }),
            open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5]
        }));

        const orb5mHigh = data[0].high;
        let sessionHigh = orb5mHigh;
        let trapFound = false;

        for (let i = 5; i < data.length; i++) {
            const d = data[i];
            const prev = data[i - 1];

            // Define a "Potential Breakout" (Crossed session high)
            const isCrossing = d.high > sessionHigh && prev.close <= sessionHigh;

            if (isCrossing && !trapFound) {
                // Check if it failed (EOD price < entry price)
                const finalClose = data[data.length - 1].close;
                if (finalClose < d.high * 0.99) { // Failed more than 1% from high
                    const preBars = data.slice(i - 4, i);
                    const avgVolPre = preBars.reduce((s, b) => s + b.volume, 0) / preBars.length;
                    const volSurge = avgVolPre > 0 ? d.volume / avgVolPre : 1;
                    const avgRange = preBars.reduce((s, b) => s + (b.high - b.low) / b.open, 0) / preBars.length;
                    const proximity = (sessionHigh - preBars[preBars.length - 1].close) / sessionHigh;

                    findings.push({
                        symbol: sym,
                        time: d.time,
                        volSurge,
                        preRange: (avgRange * 100),
                        prox: (proximity * 100),
                        loss: ((finalClose - d.high) / d.high * 100)
                    });
                    trapFound = true;
                }
            }
            if (d.high > sessionHigh) sessionHigh = d.high;
        }
    }

    console.log("MARKET MASTER ANALYSIS: Traps/Fakeouts Today");
    console.log("Symbol\tTime\tVolSurge\tPre-Range\tProximity\tEOD Return");
    console.log("-----------------------------------------------------------------------------------");
    findings.sort((a, b) => a.loss - b.loss).slice(0, 20).forEach(w => {
        console.log(`${w.symbol}\t${w.time}\t${w.volSurge.toFixed(1)}x\t\t${w.preRange.toFixed(2)}%\t\t${w.prox.toFixed(2)}%\t\t${w.loss.toFixed(1)}%`);
    });

    const avgVol = findings.reduce((s, w) => s + w.volSurge, 0) / findings.length;
    const avgRange = findings.reduce((s, w) => s + w.preRange, 0) / findings.length;
    const avgProx = findings.reduce((s, w) => s + w.prox, 0) / findings.length;

    console.log("\n--- TRAP PATTERN ---");
    console.log(`Average Volume Surge (At Fakeout): ${avgVol.toFixed(1)}x`);
    console.log(`Average Pre-Fakeout Tightness: ${avgRange.toFixed(2)}%`);
    console.log(`Average Proximity to High: ${avgProx.toFixed(2)}%`);
}

analyzeAllFakeouts(new Date().toISOString().split('T')[0]).catch(console.error);

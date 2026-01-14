// Node 24 has built-in fetch
const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function analyzeAllBreakouts(today) {
    // 1. Get all symbols traded today
    const symbolsSQL = `SELECT symbol FROM (SELECT symbol, count() as c FROM trades WHERE timestamp >= '${today}' GROUP BY symbol) WHERE c > 100`;
    const symbolsRes = await query(symbolsSQL);
    const symbols = symbolsRes.dataset.map(r => r[0]);

    console.log(`Analyzing ${symbols.length} symbols for Real Breakout patterns...\n`);

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

        let sessionHigh = data[0].high;
        let boFound = false;

        for (let i = 5; i < data.length; i++) {
            const d = data[i];
            const prev = data[i - 1];

            // Define "Real Breakout" Trigger for analysis purposes
            const priceJump = (d.close - prev.close) / prev.close;
            const isBreaking = d.close > sessionHigh && priceJump > 0.005; // >0.5% jump and break high

            if (isBreaking && !boFound) {
                // Analyze the 4 bars (20m) BEFORE this breakout
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
                    success: ((data[data.length - 1].close - d.close) / d.close * 100) // Profitability from BO to end of day
                });
                boFound = true; // Only analyze first major BO
            }
            if (d.high > sessionHigh) sessionHigh = d.high;
        }
    }

    // Filter for "Successful" breakouts (those that ended in profit)
    const winners = findings.filter(f => f.success > 1.0);

    console.log("MARKET MASTER ANALYSIS: Successful Breakouts Today");
    console.log("Symbol\tTime\tVolSurge\tPre-Range\tProximity\tEOD Profit");
    console.log("-----------------------------------------------------------------------------------");
    winners.sort((a, b) => b.success - a.success).forEach(w => {
        console.log(`${w.symbol}\t${w.time}\t${w.volSurge.toFixed(1)}x\t\t${w.preRange.toFixed(2)}%\t\t${w.prox.toFixed(2)}%\t\t${w.success.toFixed(1)}%`);
    });

    const avgVol = winners.reduce((s, w) => s + w.volSurge, 0) / winners.length;
    const avgRange = winners.reduce((s, w) => s + w.preRange, 0) / winners.length;
    const avgProx = winners.reduce((s, w) => s + w.prox, 0) / winners.length;

    console.log("\n--- CONSOLIDATED PATTERN (THE GOLDEN FORMULA) ---");
    console.log(`Average Volume Surge (At Trigger): ${avgVol.toFixed(1)}x`);
    console.log(`Average Pre-Breakout Tightness: ${avgRange.toFixed(2)}%`);
    console.log(`Average Proximity to High: ${avgProx.toFixed(2)}%`);
}

analyzeAllBreakouts(new Date().toISOString().split('T')[0]).catch(console.error);

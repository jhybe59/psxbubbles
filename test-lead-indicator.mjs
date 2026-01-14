// Node 24 has built-in fetch
const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function testPredictiveTrigger(symbol, today) {
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

    let sessionHigh = data[0].high;
    const signals = [];

    for (let i = 5; i < data.length; i++) {
        const d = data[i];
        const prevBars = data.slice(i - 4, i);

        // 1. Tightness (Consolidation)
        const avgRange = prevBars.reduce((s, b) => s + (b.high - b.low) / b.open, 0) / prevBars.length;
        const isTight = avgRange < 0.004; // < 0.4%

        // 2. Volume Pulse (Activity building)
        const avgVolPre = prevBars.reduce((s, b) => s + b.volume, 0) / prevBars.length;
        const volPulse = avgVolPre > 0 ? d.volume / avgVolPre : 1;
        const hasVolPulse = volPulse > 2.5;

        // 3. Proximity (Hugging resistance)
        const proximity = (sessionHigh - d.close) / sessionHigh;
        const isHugging = proximity < 0.003 && proximity > -0.001; // Close to or just above high

        // 4. Momentum (Bullish sentiment)
        const bullishBars = prevBars.filter(b => b.close >= b.open).length;
        const isBullish = bullishBars >= 3;

        // PRE-BREAKOUT SIGNAL (Catching it before the massive candle)
        if (isTight && hasVolPulse && isHugging && isBullish) {
            signals.push({
                time: d.time,
                price: d.close,
                volPulse: volPulse.toFixed(1) + 'x',
                tightness: (avgRange * 100).toFixed(2) + '%'
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
        LIMIT 100
    `;
    const res = await query(topSymbolsSQL);
    const symbols = res.dataset.map(r => r[0]);

    console.log("Testing PRE-BREAKOUT (Lead Indicator) on Market...\n");
    console.log("Symbol\tLead Time\tPrice\tVol Pulse\tConsolidation");
    console.log("----------------------------------------------------------------------");

    for (const sym of symbols) {
        const triggers = await testPredictiveTrigger(sym, today);
        if (triggers) {
            triggers.forEach(t => {
                console.log(`${sym}\t${t.time}\t${t.price.toFixed(2)}\t${t.volPulse}\t\t${t.tightness}`);
            });
        }
    }
}

main().catch(console.error);

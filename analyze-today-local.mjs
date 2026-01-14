// Node 24 has built-in fetch

const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    } catch (err) {
        console.error(`Query failed: ${sql}\nError: ${err.message}`);
        return { dataset: [] };
    }
}

async function analyzeBreakout(symbol, today) {
    const barsSQL = `
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

    const bars = await query(barsSQL);
    if (!bars.dataset || bars.dataset.length < 5) return null;

    const data = bars.dataset.map((b, i) => ({
        idx: i,
        time: new Date(b[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        open: b[1],
        high: b[2],
        low: b[3],
        close: b[4],
        volume: b[5] || 0
    }));

    // ORB levels
    const orb5mHigh = data[0]?.high || 0;

    // Average volume (first 30 min if available, else first few bars)
    const volLength = Math.min(data.length, 6);
    const avgVol30m = data.slice(0, volLength).reduce((s, d) => s + d.volume, 0) / volLength;
    if (avgVol30m === 0) return null;

    // Calculate RVOL for each bar
    data.forEach(d => {
        d.rvol = d.volume / avgVol30m;
    });

    // Find ORB 5m breakout
    let breakout5mIdx = -1;
    for (let i = 1; i < data.length; i++) {
        if (data[i].high > orb5mHigh) {
            breakout5mIdx = i;
            break;
        }
    }

    // Calculate gain
    const openPrice = data[0].open;
    const closePrice = data[data.length - 1].close;
    const gainPct = ((closePrice - openPrice) / openPrice * 100);

    // Max Gain relative to Open
    const maxPrice = Math.max(...data.map(d => d.high));
    const maxGainPct = ((maxPrice - openPrice) / openPrice * 100);

    return {
        symbol,
        gainPct,
        maxGainPct,
        orb5mHigh,
        breakout5mIdx,
        breakout5mTime: breakout5mIdx >= 0 ? data[breakout5mIdx].time : null,
        rvolAtBreakout: breakout5mIdx >= 0 ? data[breakout5mIdx].rvol : 0,
        bars: data.length
    };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  LOCAL BREAKOUT ANALYSIS - TODAY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const today = new Date().toISOString().split('T')[0];
    console.log(`Date: ${today}\n`);

    // Get top 50 symbols by volume today to analyze
    const topSymbolsSQL = `
        SELECT 
            symbol,
            sum(volume) as total_volume,
            (last(price) - first(price)) / first(price) * 100 as pct_change
        FROM trades
        WHERE timestamp >= '${today}'
        GROUP BY symbol
        ORDER BY pct_change DESC
        LIMIT 50
    `;

    const symbolsResult = await query(topSymbolsSQL);

    if (!symbolsResult.dataset || symbolsResult.dataset.length === 0) {
        console.log('No data found for today in QuestDB.');
        return;
    }

    console.log(`Analyzing top ${symbolsResult.dataset.length} gainers for breakout patterns...\n`);

    const results = [];
    for (const row of symbolsResult.dataset) {
        const symbol = row[0];
        const analysis = await analyzeBreakout(symbol, today);
        if (analysis && analysis.maxGainPct > 1) { // Only care about > 1% potential
            results.push(analysis);
        }
    }

    console.log('Symbol\tMaxGain%\tClose%\tORB BO\tRVOL@BO');
    console.log('─'.repeat(50));

    results
        .sort((a, b) => b.maxGainPct - a.maxGainPct)
        .forEach(r => {
            console.log(`${r.symbol}\t${r.maxGainPct.toFixed(1)}%\t${r.gainPct.toFixed(1)}%\t${r.breakout5mTime || 'N/A'}\t${r.rvolAtBreakout.toFixed(1)}x`);
        });

    const breakouts = results.filter(r => r.breakout5mIdx > 0);
    console.log(`\nFound ${breakouts.length} symbols with ORB 5m breakouts today.`);
}

main().catch(err => {
    console.error('Fatal error:', err);
});

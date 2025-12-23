/**
 * Deep RVOL Analysis - Find patterns that work
 * Looking at KOHC and other breakouts from multiple angles
 */

const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function analyzeSymbol(symbol, today) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${symbol} - RVOL DEEP ANALYSIS`);
    console.log('═'.repeat(60));

    // Get all trades for this symbol today
    const tradesSQL = `
        SELECT timestamp, price, volume
        FROM trades
        WHERE symbol = '${symbol}' AND timestamp >= '${today}'
        ORDER BY timestamp
    `;

    const trades = await query(tradesSQL);
    if (!trades.dataset || trades.dataset.length === 0) {
        console.log('No data');
        return;
    }

    // Get 5-minute bars
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
    if (!bars.dataset || bars.dataset.length === 0) return;

    // Calculate various RVOL metrics
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
    const orb15mHigh = Math.max(...data.slice(0, 3).map(d => d.high));
    const orb30mHigh = Math.max(...data.slice(0, 6).map(d => d.high));

    // Average volume (first 30 min)
    const avgVol30m = data.slice(0, 6).reduce((s, d) => s + d.volume, 0) / 6;

    // Calculate RVOL for each bar
    data.forEach(d => {
        d.rvol = avgVol30m > 0 ? (d.volume / avgVol30m) : 0;
    });

    // Calculate CUMULATIVE RVOL (rolling sum)
    let cumVol = 0;
    data.forEach((d, i) => {
        cumVol += d.volume;
        const expectedCumVol = avgVol30m * (i + 1);
        d.cumRvol = expectedCumVol > 0 ? (cumVol / expectedCumVol) : 0;
    });

    // Calculate 3-bar rolling RVOL
    data.forEach((d, i) => {
        if (i < 2) {
            d.rolling3Rvol = d.rvol;
        } else {
            const sum3 = data[i].volume + data[i - 1].volume + data[i - 2].volume;
            d.rolling3Rvol = (sum3 / 3) / avgVol30m;
        }
    });

    console.log('\nORB Levels:');
    console.log(`  5m High: ${orb5mHigh?.toFixed(2)}`);
    console.log(`  15m High: ${orb15mHigh?.toFixed(2)}`);
    console.log(`  30m High: ${orb30mHigh?.toFixed(2)}`);
    console.log(`  Avg Volume (30m): ${avgVol30m?.toLocaleString()}`);

    // Find breakout bar (first bar where high > ORB 30m)
    let breakoutIdx = -1;
    for (let i = 6; i < data.length; i++) {
        if (data[i].high > orb30mHigh) {
            breakoutIdx = i;
            break;
        }
    }

    console.log('\n--- RVOL Analysis at Different Points ---\n');
    console.log('Bar\tTime\tHigh\tClose\tRVOL\t3-Bar\tCum\tNote');
    console.log('─'.repeat(80));

    // Show all bars with different RVOL metrics
    data.slice(0, Math.min(data.length, 20)).forEach((d, i) => {
        let note = '';
        if (i < 1) note = '[ORB5m]';
        else if (i < 3) note = '[ORB15m]';
        else if (i < 6) note = '[ORB30m]';
        if (i === breakoutIdx) note = '*** BREAKOUT ***';
        if (d.rvol >= 2) note += ' RVOL>=2!';
        if (d.rolling3Rvol >= 1.5) note += ' 3bar>=1.5';
        if (d.cumRvol >= 1.5) note += ' Cum>=1.5';

        console.log(`${i + 1}\t${d.time}\t${d.high?.toFixed(2)}\t${d.close?.toFixed(2)}\t${d.rvol?.toFixed(1)}x\t${d.rolling3Rvol?.toFixed(1)}x\t${d.cumRvol?.toFixed(1)}x\t${note}`);
    });

    // Analyze bars around breakout
    if (breakoutIdx > 0) {
        console.log('\n--- DETAILED BREAKOUT ANALYSIS ---\n');
        console.log(`Breakout at bar #${breakoutIdx + 1} (${data[breakoutIdx].time})`);

        // Look at 5 bars before breakout
        console.log('\n5 bars BEFORE breakout:');
        for (let i = Math.max(0, breakoutIdx - 5); i < breakoutIdx; i++) {
            const d = data[i];
            console.log(`  Bar ${i + 1}: Vol=${d.volume?.toLocaleString()}, RVOL=${d.rvol?.toFixed(1)}x, 3-bar=${d.rolling3Rvol?.toFixed(1)}x`);
        }

        console.log('\nBreakout bar:');
        const bd = data[breakoutIdx];
        console.log(`  Bar ${breakoutIdx + 1}: Vol=${bd.volume?.toLocaleString()}, RVOL=${bd.rvol?.toFixed(1)}x, 3-bar=${bd.rolling3Rvol?.toFixed(1)}x, Cum=${bd.cumRvol?.toFixed(1)}x`);

        // Was there ANY bar before breakout with RVOL >= 1.5?
        const highVolBefore = data.slice(6, breakoutIdx).filter(d => d.rvol >= 1.5);
        console.log(`\nBars with RVOL >= 1.5 before breakout: ${highVolBefore.length}`);
        highVolBefore.forEach(d => console.log(`  Bar ${d.idx + 1} (${d.time}): ${d.rvol?.toFixed(1)}x`));

        // Check if cumulative RVOL was high before breakout
        const cumRvolBeforeBreakout = data[breakoutIdx - 1]?.cumRvol;
        console.log(`\nCumulative RVOL just before breakout: ${cumRvolBeforeBreakout?.toFixed(2)}x`);
    }

    // Find maximum RVOL and when it occurred
    let maxRvol = 0;
    let maxRvolIdx = 0;
    data.forEach((d, i) => {
        if (d.rvol > maxRvol) {
            maxRvol = d.rvol;
            maxRvolIdx = i;
        }
    });

    console.log(`\nMax RVOL: ${maxRvol?.toFixed(1)}x at bar #${maxRvolIdx + 1} (${data[maxRvolIdx]?.time})`);
    if (breakoutIdx > 0) {
        const relation = maxRvolIdx < breakoutIdx ? 'BEFORE' : maxRvolIdx === breakoutIdx ? 'AT' : 'AFTER';
        console.log(`Max RVOL occurred ${relation} breakout`);
    }
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  RVOL DEEP ANALYSIS - Finding Patterns That Work');
    console.log('═══════════════════════════════════════════════════════════════');

    const today = new Date().toISOString().split('T')[0];
    console.log(`Date: ${today}\n`);

    // Analyze top breakout stocks
    const symbols = ['KOHC', 'ATRL', 'SEARL', 'WAVES', 'CHCC'];

    for (const symbol of symbols) {
        await analyzeSymbol(symbol, today);
    }

    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('  SUMMARY - ALTERNATIVE RVOL APPROACHES');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`
Possible approaches that include RVOL:

1. CUMULATIVE RVOL >= 1.5
   - Track total volume vs expected volume
   - Less sensitive to single-bar spikes

2. 3-BAR ROLLING RVOL >= 1.5
   - Average of last 3 bars
   - Smoother signal

3. ANY BAR with RVOL >= 2 in last N bars
   - Look back at recent history
   - Volume spike may precede breakout

4. RVOL TREND (increasing volume pattern)
   - Volume increasing each bar
   - Building momentum

5. LOWER THRESHOLD (RVOL >= 1.5)
   - Less strict but still meaningful
   - More signals, some noise
`);
}

main();

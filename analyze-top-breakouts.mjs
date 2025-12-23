/**
 * DEEP PATTERN ANALYSIS - Top 10 Breakouts (5 Days)
 * Analyze RVOL, ORB, Timing patterns for biggest movers
 */

const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function analyzeBreakout(symbol, day) {
    const nextDay = new Date(new Date(day).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const barsSQL = `
        SELECT 
            timestamp,
            first(price) as open,
            max(price) as high,
            min(price) as low,
            last(price) as close,
            sum(volume) as volume
        FROM trades
        WHERE symbol = '${symbol}' AND timestamp >= '${day}' AND timestamp < '${nextDay}'
        SAMPLE BY 5m
        ORDER BY timestamp
    `;

    const bars = await query(barsSQL);
    if (!bars.dataset || bars.dataset.length < 10) return null;

    const data = bars.dataset.map((b, i) => ({
        idx: i,
        time: new Date(b[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        open: b[1],
        high: b[2],
        low: b[3],
        close: b[4],
        volume: b[5] || 0
    }));

    // ORB levels (first 30 min = 6 bars)
    const orb5mHigh = data[0]?.high || 0;
    const orb15mHigh = Math.max(...data.slice(0, 3).map(d => d.high));
    const orb30mHigh = Math.max(...data.slice(0, 6).map(d => d.high));

    // Average volume (first 30 min)
    const avgVol30m = data.slice(0, 6).reduce((s, d) => s + d.volume, 0) / 6;
    if (avgVol30m === 0) return null;

    // Calculate RVOL for each bar
    data.forEach(d => {
        d.rvol = d.volume / avgVol30m;
    });

    // Find ORB breakouts
    let breakout5mIdx = -1, breakout15mIdx = -1, breakout30mIdx = -1;

    for (let i = 1; i < data.length && breakout5mIdx === -1; i++) {
        if (data[i].high > orb5mHigh) breakout5mIdx = i;
    }
    for (let i = 3; i < data.length && breakout15mIdx === -1; i++) {
        if (data[i].high > orb15mHigh) breakout15mIdx = i;
    }
    for (let i = 6; i < data.length && breakout30mIdx === -1; i++) {
        if (data[i].high > orb30mHigh) breakout30mIdx = i;
    }

    // Max RVOL
    let maxRvol = 0, maxRvolIdx = 0;
    data.forEach((d, i) => {
        if (d.rvol > maxRvol) { maxRvol = d.rvol; maxRvolIdx = i; }
    });

    // RVOL at breakout bars
    const rvol5m = breakout5mIdx >= 0 ? data[breakout5mIdx].rvol : 0;
    const rvol15m = breakout15mIdx >= 0 ? data[breakout15mIdx].rvol : 0;
    const rvol30m = breakout30mIdx >= 0 ? data[breakout30mIdx].rvol : 0;

    // Any high RVOL before breakout?
    const rvol2Before5m = breakout5mIdx > 0 && data.slice(0, breakout5mIdx).some(d => d.rvol >= 2);
    const rvol15Before5m = breakout5mIdx > 0 && data.slice(0, breakout5mIdx).some(d => d.rvol >= 1.5);

    // Day's gain
    const gain = ((data[data.length - 1].close - data[0].open) / data[0].open * 100);

    return {
        symbol, day, gain,
        orb5mHigh, orb15mHigh, orb30mHigh,
        avgVol30m,
        breakout5mIdx, breakout5mTime: breakout5mIdx >= 0 ? data[breakout5mIdx].time : null,
        breakout15mIdx, breakout15mTime: breakout15mIdx >= 0 ? data[breakout15mIdx].time : null,
        breakout30mIdx, breakout30mTime: breakout30mIdx >= 0 ? data[breakout30mIdx].time : null,
        rvol5m, rvol15m, rvol30m,
        maxRvol, maxRvolIdx, maxRvolTime: data[maxRvolIdx]?.time,
        maxRvolRelation: breakout5mIdx >= 0 ? (maxRvolIdx < breakout5mIdx ? 'BEFORE' : maxRvolIdx === breakout5mIdx ? 'AT' : 'AFTER') : 'N/A',
        rvol2Before5m, rvol15Before5m,
        totalBars: data.length
    };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DEEP PATTERN ANALYSIS - TOP BREAKOUTS (5 Days)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Top 15 breakouts to analyze
    const topBreakouts = [
        { symbol: 'SGPL', day: '2025-12-17' },    // +16.2%
        { symbol: 'QUICE', day: '2025-12-17' },   // +10.0%
        { symbol: 'ITTEFAQ', day: '2025-12-17' }, // +9.3%
        { symbol: 'KOHC', day: '2025-12-23' },    // +9.0%
        { symbol: 'IBLHL', day: '2025-12-17' },   // +8.9%
        { symbol: 'ENGROH', day: '2025-12-18' },  // +8.3%
        { symbol: 'MACFL', day: '2025-12-18' },   // +7.9%
        { symbol: 'SEL', day: '2025-12-17' },     // +7.7%
        { symbol: 'SGPL', day: '2025-12-22' },    // +7.4%
        { symbol: 'LOTCHEM', day: '2025-12-17' }, // +7.1%
        { symbol: 'MUGHAL', day: '2025-12-18' },  // +7.0%
        { symbol: 'SGPL', day: '2025-12-18' },    // +6.5%
        { symbol: 'FECTC', day: '2025-12-17' },   // +6.4%
        { symbol: 'MUGHAL', day: '2025-12-22' },  // +5.9%
        { symbol: 'QUICE', day: '2025-12-22' },   // +5.5%
    ];

    const results = [];

    for (const { symbol, day } of topBreakouts) {
        process.stdout.write(`Analyzing ${symbol} (${day})... `);
        const analysis = await analyzeBreakout(symbol, day);
        if (analysis) {
            results.push(analysis);
            console.log(`+${analysis.gain.toFixed(2)}%`);
        } else {
            console.log('skipped');
        }
    }

    // Summary table
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('  BREAKOUT PATTERN SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Symbol\tDay\t\tGain\tBO Time\tRVOL@BO\tMaxRVOL\tMax When\tRVOL>=2 Before?');
    console.log('─'.repeat(100));

    results.forEach(r => {
        console.log(`${r.symbol}\t${r.day}\t+${r.gain.toFixed(1)}%\t${r.breakout5mTime || 'N/A'}\t${r.rvol5m.toFixed(1)}x\t${r.maxRvol.toFixed(1)}x\t${r.maxRvolRelation}\t\t${r.rvol2Before5m ? 'YES' : 'NO'}`);
    });

    // STATISTICS
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('  STATISTICAL ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const valid = results.filter(r => r.breakout5mIdx > 0);

    // 1. When does max RVOL occur?
    const mBefore = valid.filter(r => r.maxRvolRelation === 'BEFORE').length;
    const mAt = valid.filter(r => r.maxRvolRelation === 'AT').length;
    const mAfter = valid.filter(r => r.maxRvolRelation === 'AFTER').length;

    console.log(`Analyzed: ${valid.length} breakouts\n`);

    console.log('1. WHEN DOES MAX RVOL OCCUR?');
    console.log(`   BEFORE breakout: ${mBefore} (${(mBefore / valid.length * 100).toFixed(0)}%)`);
    console.log(`   AT breakout:     ${mAt} (${(mAt / valid.length * 100).toFixed(0)}%)`);
    console.log(`   AFTER breakout:  ${mAfter} (${(mAfter / valid.length * 100).toFixed(0)}%)`);

    // 2. RVOL at breakout
    const rvol2AtBO = valid.filter(r => r.rvol5m >= 2).length;
    const rvol15AtBO = valid.filter(r => r.rvol5m >= 1.5).length;
    const rvol1AtBO = valid.filter(r => r.rvol5m >= 1).length;

    console.log('\n2. RVOL AT BREAKOUT BAR:');
    console.log(`   RVOL >= 2.0:  ${rvol2AtBO} (${(rvol2AtBO / valid.length * 100).toFixed(0)}%)`);
    console.log(`   RVOL >= 1.5:  ${rvol15AtBO} (${(rvol15AtBO / valid.length * 100).toFixed(0)}%)`);
    console.log(`   RVOL >= 1.0:  ${rvol1AtBO} (${(rvol1AtBO / valid.length * 100).toFixed(0)}%)`);

    // 3. Any RVOL >= 2 before breakout?
    const hadRvol2Before = valid.filter(r => r.rvol2Before5m).length;
    const hadRvol15Before = valid.filter(r => r.rvol15Before5m).length;

    console.log('\n3. ANY RVOL >= 2 BEFORE BREAKOUT?');
    console.log(`   Had RVOL >= 2.0:  ${hadRvol2Before} (${(hadRvol2Before / valid.length * 100).toFixed(0)}%)`);
    console.log(`   Had RVOL >= 1.5:  ${hadRvol15Before} (${(hadRvol15Before / valid.length * 100).toFixed(0)}%)`);

    // 4. Breakout timing
    const timeBuckets = {};
    valid.forEach(r => {
        if (r.breakout5mTime) {
            const hour = r.breakout5mTime.split(':')[0];
            timeBuckets[hour] = (timeBuckets[hour] || 0) + 1;
        }
    });

    console.log('\n4. BREAKOUT TIMING:');
    Object.keys(timeBuckets).sort().forEach(h => {
        console.log(`   ${h}:xx - ${timeBuckets[h]} breakouts (${(timeBuckets[h] / valid.length * 100).toFixed(0)}%)`);
    });

    // 5. Average metrics
    const avgRvolAtBO = valid.reduce((s, r) => s + r.rvol5m, 0) / valid.length;
    const avgMaxRvol = valid.reduce((s, r) => s + r.maxRvol, 0) / valid.length;

    console.log('\n5. AVERAGES:');
    console.log(`   Avg RVOL at breakout: ${avgRvolAtBO.toFixed(2)}x`);
    console.log(`   Avg Max RVOL of day:  ${avgMaxRvol.toFixed(2)}x`);

    // CONCLUSIONS
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('  CONCLUSIONS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (mAfter / valid.length > 0.6) {
        console.log(`📊 Max RVOL comes AFTER breakout ${(mAfter / valid.length * 100).toFixed(0)}% of the time`);
        console.log('   → Volume confirms breakout, does not predict it');
    }

    if (rvol2AtBO / valid.length < 0.4) {
        console.log(`\n⚠️  RVOL >= 2 at breakout only catches ${(rvol2AtBO / valid.length * 100).toFixed(0)}% of top breakouts`);
        console.log('   → Current strategy misses too many opportunities');
    }

    const firstHour = (timeBuckets['09'] || 0) + (timeBuckets['10'] || 0);
    if (firstHour / valid.length > 0.7) {
        console.log(`\n⏰ ${(firstHour / valid.length * 100).toFixed(0)}% of breakouts happen in first hour (09:30-10:30)`);
        console.log('   → Focus on early session for maximum signal capture');
    }
}

main().catch(console.error);

/**
 * COMPREHENSIVE BREAKOUT ANALYSIS
 * Analyze ALL breakouts from today and find common patterns
 */

const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
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

    // ORB levels
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

    // Find ORB 5m breakout
    let breakout5mIdx = -1;
    for (let i = 1; i < data.length; i++) {
        if (data[i].high > orb5mHigh) {
            breakout5mIdx = i;
            break;
        }
    }

    // Find ORB 30m breakout
    let breakout30mIdx = -1;
    for (let i = 6; i < data.length; i++) {
        if (data[i].high > orb30mHigh) {
            breakout30mIdx = i;
            break;
        }
    }

    // Find max RVOL and when
    let maxRvol = 0;
    let maxRvolIdx = 0;
    data.forEach((d, i) => {
        if (d.rvol > maxRvol) {
            maxRvol = d.rvol;
            maxRvolIdx = i;
        }
    });

    // Check if any bar had RVOL >= 2 before breakout
    const highRvolBeforeBreakout = breakout5mIdx > 0
        ? data.slice(0, breakout5mIdx).filter(d => d.rvol >= 2).length
        : 0;

    // Check if any bar in last 10 bars before breakout had RVOL >= 1.5
    const last10BeforeBreakout = breakout5mIdx > 0
        ? data.slice(Math.max(0, breakout5mIdx - 10), breakout5mIdx)
        : [];
    const anyRvol15Before = last10BeforeBreakout.some(d => d.rvol >= 1.5);
    const anyRvol2Before = last10BeforeBreakout.some(d => d.rvol >= 2);

    // RVOL at breakout bar
    const rvolAtBreakout = breakout5mIdx >= 0 ? data[breakout5mIdx].rvol : 0;

    // Calculate gain
    const openPrice = data[0].open;
    const closePrice = data[data.length - 1].close;
    const gainPct = ((closePrice - openPrice) / openPrice * 100);

    return {
        symbol,
        gainPct,
        orb5mHigh,
        orb30mHigh,
        avgVol30m,
        breakout5mIdx,
        breakout5mTime: breakout5mIdx >= 0 ? data[breakout5mIdx].time : null,
        breakout30mIdx,
        breakout30mTime: breakout30mIdx >= 0 ? data[breakout30mIdx].time : null,
        maxRvol,
        maxRvolIdx,
        maxRvolTime: data[maxRvolIdx]?.time,
        maxRvolRelation: breakout5mIdx >= 0 ? (maxRvolIdx < breakout5mIdx ? 'BEFORE' : maxRvolIdx === breakout5mIdx ? 'AT' : 'AFTER') : 'N/A',
        rvolAtBreakout,
        highRvolBeforeBreakout,
        anyRvol15Before,
        anyRvol2Before,
        bars: data.length
    };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  COMPREHENSIVE BREAKOUT ANALYSIS - ALL STOCKS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const today = new Date().toISOString().split('T')[0];
    console.log(`Date: ${today}\n`);

    // Get ALL stocks with positive movement today
    const gainersSQL = `
        SELECT 
            symbol,
            first(price) as open_price,
            last(price) as close_price
        FROM trades
        WHERE timestamp >= '${today}'
        GROUP BY symbol
        ORDER BY (last(price) - first(price)) / first(price) DESC
        LIMIT 30
    `;

    const gainers = await query(gainersSQL);

    if (!gainers.dataset || gainers.dataset.length === 0) {
        console.log('No gainers found');
        return;
    }

    console.log(`Found ${gainers.dataset.length} stocks with gain > 0.5%\n`);

    // Analyze each
    const results = [];

    for (const row of gainers.dataset) {
        const symbol = row[0];
        process.stdout.write(`Analyzing ${symbol}... `);

        const analysis = await analyzeBreakout(symbol, today);
        if (analysis) {
            results.push(analysis);
            console.log(`+${analysis.gainPct.toFixed(2)}%`);
        } else {
            console.log('skipped');
        }
    }

    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('  BREAKOUT SUMMARY TABLE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Symbol\tGain%\tBreakout\tMaxRVOL\tMaxWhen\tRVOL@BO\tRVOL>=2 Before?');
    console.log('─'.repeat(90));

    results.forEach(r => {
        console.log(`${r.symbol}\t${r.gainPct.toFixed(1)}%\t${r.breakout5mTime || 'N/A'}\t\t${r.maxRvol.toFixed(1)}x\t${r.maxRvolRelation}\t${r.rvolAtBreakout.toFixed(1)}x\t${r.anyRvol2Before ? 'YES' : 'NO'}`);
    });

    // STATISTICS
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('  PATTERN STATISTICS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const withBreakout = results.filter(r => r.breakout5mIdx > 0);
    const maxRvolBefore = withBreakout.filter(r => r.maxRvolRelation === 'BEFORE').length;
    const maxRvolAt = withBreakout.filter(r => r.maxRvolRelation === 'AT').length;
    const maxRvolAfter = withBreakout.filter(r => r.maxRvolRelation === 'AFTER').length;

    const rvolAtBreakout2 = withBreakout.filter(r => r.rvolAtBreakout >= 2).length;
    const rvolAtBreakout15 = withBreakout.filter(r => r.rvolAtBreakout >= 1.5).length;
    const anyRvol2Before = withBreakout.filter(r => r.anyRvol2Before).length;
    const anyRvol15Before = withBreakout.filter(r => r.anyRvol15Before).length;

    console.log(`Total breakouts analyzed: ${withBreakout.length}`);
    console.log('');
    console.log('1. WHEN DOES MAX RVOL OCCUR?');
    console.log(`   BEFORE breakout: ${maxRvolBefore} (${(maxRvolBefore / withBreakout.length * 100).toFixed(0)}%)`);
    console.log(`   AT breakout:     ${maxRvolAt} (${(maxRvolAt / withBreakout.length * 100).toFixed(0)}%)`);
    console.log(`   AFTER breakout:  ${maxRvolAfter} (${(maxRvolAfter / withBreakout.length * 100).toFixed(0)}%)`);
    console.log('');
    console.log('2. RVOL AT BREAKOUT BAR:');
    console.log(`   RVOL >= 2.0:  ${rvolAtBreakout2} (${(rvolAtBreakout2 / withBreakout.length * 100).toFixed(0)}%)`);
    console.log(`   RVOL >= 1.5:  ${rvolAtBreakout15} (${(rvolAtBreakout15 / withBreakout.length * 100).toFixed(0)}%)`);
    console.log('');
    console.log('3. ANY HIGH RVOL IN LAST 10 BARS BEFORE BREAKOUT?');
    console.log(`   Had RVOL >= 2.0:  ${anyRvol2Before} (${(anyRvol2Before / withBreakout.length * 100).toFixed(0)}%)`);
    console.log(`   Had RVOL >= 1.5:  ${anyRvol15Before} (${(anyRvol15Before / withBreakout.length * 100).toFixed(0)}%)`);

    // Average RVOL at breakout
    const avgRvolAtBreakout = withBreakout.reduce((s, r) => s + r.rvolAtBreakout, 0) / withBreakout.length;
    console.log('');
    console.log(`4. AVERAGE RVOL AT BREAKOUT: ${avgRvolAtBreakout.toFixed(2)}x`);

    // Breakout timing analysis
    const breakoutTimes = withBreakout.map(r => r.breakout5mTime).filter(t => t);
    console.log('');
    console.log('5. BREAKOUT TIMING:');
    const timeBuckets = {};
    breakoutTimes.forEach(t => {
        const hour = t.split(':')[0];
        timeBuckets[hour] = (timeBuckets[hour] || 0) + 1;
    });
    Object.keys(timeBuckets).sort().forEach(h => {
        console.log(`   ${h}:xx - ${timeBuckets[h]} breakouts`);
    });

    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('  CONCLUSIONS & RECOMMENDATIONS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (rvolAtBreakout2 / withBreakout.length < 0.3) {
        console.log('⚠️  RVOL >= 2 at breakout bar catches only ' + (rvolAtBreakout2 / withBreakout.length * 100).toFixed(0) + '% of breakouts!');
    }
    if (anyRvol2Before / withBreakout.length > 0.5) {
        console.log('✅  "Any RVOL >= 2 in last 10 bars" catches ' + (anyRvol2Before / withBreakout.length * 100).toFixed(0) + '% of breakouts!');
    }
    if (maxRvolAfter / withBreakout.length > 0.5) {
        console.log('📊  Max RVOL comes AFTER breakout in ' + (maxRvolAfter / withBreakout.length * 100).toFixed(0) + '% of cases');
    }
}

main().catch(console.error);

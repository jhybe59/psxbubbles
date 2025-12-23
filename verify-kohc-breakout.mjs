/**
 * Check KOHC breakout with Rolling RVOL 1.5x condition
 */

const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  KOHC BREAKOUT ANALYSIS - Rolling RVOL 1.5x Check');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const today = '2025-12-23';

    // Get KOHC 5-minute bars
    const barsSQL = `
        SELECT 
            timestamp,
            first(price) as open,
            max(price) as high,
            min(price) as low,
            last(price) as close,
            sum(volume) as volume
        FROM trades
        WHERE symbol = 'KOHC' AND timestamp >= '${today}'
        SAMPLE BY 5m
        ORDER BY timestamp
    `;

    const bars = await query(barsSQL);
    if (!bars.dataset || bars.dataset.length < 10) {
        console.log('No data');
        return;
    }

    const data = bars.dataset.map((b, i) => ({
        idx: i,
        time: new Date(b[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        open: b[1],
        high: b[2],
        low: b[3],
        close: b[4],
        volume: b[5] || 0
    }));

    // ORB 5m High
    const orb5mHigh = data[0]?.high || 0;
    console.log('ORB 5m High:', orb5mHigh);
    console.log('');

    // Calculate Rolling RVOL (vs previous 20 bars)
    data.forEach((d, i) => {
        if (i < 20) {
            // Not enough history, use what we have
            const prevBars = data.slice(0, i);
            const avgVol = prevBars.length > 0 ? prevBars.reduce((s, b) => s + b.volume, 0) / prevBars.length : d.volume;
            d.rollingRvol = avgVol > 0 ? d.volume / avgVol : 0;
        } else {
            // Full 20 bar lookback
            const prev20 = data.slice(i - 20, i);
            const avgVol = prev20.reduce((s, b) => s + b.volume, 0) / 20;
            d.rollingRvol = avgVol > 0 ? d.volume / avgVol : 0;
        }
    });

    // Find breakout bar (first bar where high > ORB 5m)
    let breakoutIdx = -1;
    for (let i = 1; i < data.length; i++) {
        if (data[i].high > orb5mHigh) {
            breakoutIdx = i;
            break;
        }
    }

    console.log('Breakout Bar:', breakoutIdx >= 0 ? `#${breakoutIdx + 1} at ${data[breakoutIdx].time}` : 'None');
    console.log('');

    // Show bars around and at breakout
    console.log('BARS ANALYSIS:');
    console.log('Bar#\tTime\tHigh\tClose\tVolume\t\tRolling RVOL\tBreakout?');
    console.log('─'.repeat(90));

    const startShow = Math.max(0, breakoutIdx - 5);
    const endShow = Math.min(data.length, breakoutIdx + 10);

    for (let i = startShow; i < endShow; i++) {
        const d = data[i];
        const isBreakout = d.high > orb5mHigh;
        const rvolCheck = d.rollingRvol >= 1.5 ? '✅ >=1.5' : '❌ <1.5';
        const breakoutMark = i === breakoutIdx ? '← FIRST BREAKOUT' : (isBreakout ? 'ABOVE ORB' : '');

        console.log(`${i + 1}\t${d.time}\t${d.high?.toFixed(2)}\t${d.close?.toFixed(2)}\t${d.volume?.toLocaleString()}\t\t${d.rollingRvol.toFixed(2)}x ${rvolCheck}\t${breakoutMark}`);
    }

    // Check if we would have caught the breakout
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('  WOULD WE HAVE CAUGHT KOHC BREAKOUT?');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (breakoutIdx >= 0) {
        const breakoutBar = data[breakoutIdx];
        const rvol = breakoutBar.rollingRvol;

        console.log('At breakout moment (bar #' + (breakoutIdx + 1) + '):');
        console.log('  Price:', breakoutBar.high.toFixed(2), '> ORB High:', orb5mHigh.toFixed(2), '✅');
        console.log('  Rolling RVOL:', rvol.toFixed(2) + 'x');
        console.log('');

        if (rvol >= 1.5) {
            console.log('  ✅ RVOL >= 1.5 - BREAKOUT WOULD HAVE TRIGGERED!');
        } else {
            console.log('  ❌ RVOL < 1.5 - Breakout would NOT have triggered at this moment');

            // Check if any bar after breakout would have triggered
            console.log('');
            console.log('  Checking subsequent bars...');
            for (let i = breakoutIdx; i < Math.min(data.length, breakoutIdx + 10); i++) {
                const d = data[i];
                if (d.high > orb5mHigh && d.rollingRvol >= 1.5) {
                    console.log(`  ✅ Bar #${i + 1} (${d.time}): RVOL ${d.rollingRvol.toFixed(2)}x >= 1.5 - Would trigger here!`);
                    break;
                }
            }
        }
    }
}

main().catch(console.error);

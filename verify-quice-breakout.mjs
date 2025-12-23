/**
 * Check QUICE breakout with Rolling RVOL 1.5x
 */

const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function query(sql) {
    const res = await fetch(`${QUESTDB_URL}?query=${encodeURIComponent(sql)}`);
    return res.json();
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  QUICE BREAKOUT ANALYSIS - Rolling RVOL 1.5x Check');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const today = '2025-12-23';

    const barsSQL = `
        SELECT timestamp, first(price) as open, max(price) as high, min(price) as low, last(price) as close, sum(volume) as volume
        FROM trades
        WHERE symbol = 'QUICE' AND timestamp >= '${today}'
        SAMPLE BY 5m
        ORDER BY timestamp
    `;

    const bars = await query(barsSQL);
    if (!bars.dataset || bars.dataset.length < 5) {
        console.log('No QUICE data');
        return;
    }

    const data = bars.dataset.map((b, i) => ({
        idx: i,
        time: new Date(b[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5] || 0
    }));

    const orb5mHigh = data[0].high;
    console.log('ORB 5m High:', orb5mHigh);
    console.log('');

    // Calculate Rolling RVOL
    data.forEach((d, i) => {
        const start = Math.max(0, i - 20);
        const prev = data.slice(start, i);
        const avg = prev.length > 0 ? prev.reduce((s, b) => s + b.volume, 0) / prev.length : d.volume;
        d.rvol = avg > 0 ? d.volume / avg : 0;
    });

    // Find breakout
    let breakoutIdx = -1;
    for (let i = 1; i < data.length; i++) {
        if (data[i].high > orb5mHigh) { breakoutIdx = i; break; }
    }

    console.log('Breakout at bar #' + (breakoutIdx + 1), '(' + data[breakoutIdx]?.time + ')');
    console.log('');
    console.log('Bar#\tTime\tHigh\tVolume\t\tRVOL\t\tStatus');
    console.log('─'.repeat(80));

    const start = Math.max(0, breakoutIdx - 3);
    const end = Math.min(data.length, breakoutIdx + 8);

    for (let i = start; i < end; i++) {
        const b = data[i];
        const rvolOk = b.rvol >= 1.5 ? '✅ >=1.5' : '❌ <1.5';
        const mark = i === breakoutIdx ? '← FIRST BREAKOUT' : '';
        console.log(`${i + 1}\t${b.time}\t${b.high?.toFixed(2)}\t${b.volume?.toLocaleString()}\t\t${b.rvol?.toFixed(2)}x ${rvolOk}\t${mark}`);
    }

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  WOULD WE HAVE CAUGHT QUICE BREAKOUT?');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (breakoutIdx >= 0) {
        const b = data[breakoutIdx];
        console.log('At breakout moment (bar #' + (breakoutIdx + 1) + '):');
        console.log('  Price:', b.high.toFixed(2), '> ORB High:', orb5mHigh.toFixed(2), '✅');
        console.log('  Rolling RVOL:', b.rvol?.toFixed(2) + 'x');
        console.log('');

        if (b.rvol >= 1.5) {
            console.log('  ✅ RVOL >= 1.5 - BREAKOUT WOULD HAVE TRIGGERED!');
        } else {
            console.log('  ❌ RVOL < 1.5 - Would NOT trigger at breakout moment');
            console.log('');
            console.log('  Checking subsequent bars...');

            for (let i = breakoutIdx; i < Math.min(data.length, breakoutIdx + 15); i++) {
                if (data[i].high > orb5mHigh && data[i].rvol >= 1.5) {
                    console.log(`  ✅ Bar #${i + 1} (${data[i].time}): RVOL ${data[i].rvol.toFixed(2)}x >= 1.5 - Would trigger here!`);
                    break;
                }
            }
        }
    }
}

main().catch(console.error);

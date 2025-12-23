/**
 * Re-analyze QUICE - Full day view
 */

const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function query(sql) {
    const res = await fetch(`${QUESTDB_URL}?query=${encodeURIComponent(sql)}`);
    return res.json();
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  QUICE FULL DAY ANALYSIS');
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
    if (!bars.dataset) { console.log('No data'); return; }

    const data = bars.dataset.map((b, i) => ({
        idx: i,
        time: new Date(b[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5] || 0
    }));

    // Calculate Rolling RVOL
    data.forEach((d, i) => {
        const start = Math.max(0, i - 20);
        const prev = data.slice(start, i);
        const avg = prev.length > 0 ? prev.reduce((s, b) => s + b.volume, 0) / prev.length : d.volume;
        d.rvol = avg > 0 ? d.volume / avg : 0;
    });

    console.log('FULL DAY BARS:');
    console.log('Bar#\tTime\tOpen\tHigh\tLow\tClose\tVolume\t\tRVOL');
    console.log('─'.repeat(90));

    data.forEach((b, i) => {
        const rvolMark = b.rvol >= 1.5 ? '✅' : '';
        console.log(`${i + 1}\t${b.time}\t${b.open?.toFixed(2)}\t${b.high?.toFixed(2)}\t${b.low?.toFixed(2)}\t${b.close?.toFixed(2)}\t${b.volume?.toLocaleString()}\t\t${b.rvol?.toFixed(2)}x ${rvolMark}`);
    });

    // Find highest volume bar
    let maxVolIdx = 0;
    data.forEach((d, i) => { if (d.volume > data[maxVolIdx].volume) maxVolIdx = i; });

    console.log('\n');
    console.log('MAX VOLUME BAR:', data[maxVolIdx].time, 'Volume:', data[maxVolIdx].volume?.toLocaleString(), 'RVOL:', data[maxVolIdx].rvol?.toFixed(2) + 'x');

    // Find bars where price went above 19.0 (resistance level)
    const above19 = data.filter(d => d.high >= 19.0);
    console.log('\nBars with High >= 19.0:', above19.length);

    // Find the REAL breakout - price going above 19.5
    console.log('\n');
    console.log('REAL BREAKOUT SEARCH (Price > 19.5):');
    data.forEach((d, i) => {
        if (d.high > 19.5) {
            console.log(`  Bar #${i + 1} (${d.time}): High=${d.high?.toFixed(2)}, RVOL=${d.rvol?.toFixed(2)}x`);
        }
    });
}

main().catch(console.error);

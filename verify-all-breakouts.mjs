/**
 * Check ALL today's breakouts with RVOL 1.5x
 */

const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function query(sql) {
    const res = await fetch(`${QUESTDB_URL}?query=${encodeURIComponent(sql)}`);
    return res.json();
}

async function checkBreakout(symbol, today) {
    const barsSQL = `
        SELECT timestamp, first(price) as open, max(price) as high, min(price) as low, last(price) as close, sum(volume) as volume
        FROM trades
        WHERE symbol = '${symbol}' AND timestamp >= '${today}'
        SAMPLE BY 5m
        ORDER BY timestamp
    `;

    const bars = await query(barsSQL);
    if (!bars.dataset || bars.dataset.length < 5) return null;

    const data = bars.dataset.map((b, i) => ({
        idx: i, open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5] || 0
    }));

    const orb5mHigh = data[0].high;
    const dayGain = ((data[data.length - 1].close - data[0].open) / data[0].open * 100);

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

    if (breakoutIdx < 0) return null;

    const rvolAtBreakout = data[breakoutIdx].rvol;
    const wouldTrigger15 = rvolAtBreakout >= 1.5;
    const wouldTrigger10 = rvolAtBreakout >= 1.0;

    return {
        symbol,
        dayGain,
        breakoutIdx,
        rvolAtBreakout,
        wouldTrigger15,
        wouldTrigger10
    };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ALL TODAY\'S BREAKOUTS - RVOL Check');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const today = '2025-12-23';
    const symbols = ['KOHC', 'QUICE', 'PIOC', 'ATRL', 'CHCC', 'GWLC', 'LUCK', 'WAVES', 'EPCL', 'SEARL', 'GAL'];

    console.log('Symbol\tGain%\tRVOL@BO\t1.5x?\t1.0x?');
    console.log('─'.repeat(50));

    let caught15 = 0, caught10 = 0, total = 0;

    for (const symbol of symbols) {
        const result = await checkBreakout(symbol, today);
        if (result && result.dayGain > 0.5) {
            total++;
            if (result.wouldTrigger15) caught15++;
            if (result.wouldTrigger10) caught10++;

            const t15 = result.wouldTrigger15 ? '✅' : '❌';
            const t10 = result.wouldTrigger10 ? '✅' : '❌';
            console.log(`${result.symbol}\t+${result.dayGain.toFixed(1)}%\t${result.rvolAtBreakout.toFixed(2)}x\t${t15}\t${t10}`);
        }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total breakouts: ${total}`);
    console.log(`Caught with RVOL >= 1.5: ${caught15}/${total} (${(caught15 / total * 100).toFixed(0)}%)`);
    console.log(`Caught with RVOL >= 1.0: ${caught10}/${total} (${(caught10 / total * 100).toFixed(0)}%)`);
}

main().catch(console.error);

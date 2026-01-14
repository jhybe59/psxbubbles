// Node 24 has built-in fetch

const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function getDetailedData(symbol, today) {
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
    return res.dataset.map(b => ({
        time: new Date(b[0]).toLocaleTimeString('en-US', { hour12: false }),
        open: b[1],
        high: b[2],
        low: b[3],
        close: b[4],
        volume: b[5]
    }));
}

async function main() {
    const today = new Date().toISOString().split('T')[0];

    const symbols = ['YOUW', 'ZAL', 'KOHC', 'GCIL'];
    console.log(`Analyzing patterns for: ${symbols.join(', ')}\n`);

    for (const symbol of symbols) {
        const data = await getDetailedData(symbol, today);
        console.log(`--- ${symbol} ---`);
        const orb5mHigh = data[0].high;
        console.log(`ORB 5m High: ${orb5mHigh}`);

        data.slice(0, 15).forEach((d, i) => {
            const status = d.high > orb5mHigh ? 'BO' : '  ';
            const change = (((d.close - d.open) / d.open) * 100).toFixed(2);
            console.log(`${d.time}\t${d.close.toFixed(2)}\tVol: ${d.volume.toLocaleString()}\t${change}%\t${status}`);
        });
        console.log('\n');
    }
}

main().catch(console.error);

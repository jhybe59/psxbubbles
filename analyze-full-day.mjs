// Node 24 has built-in fetch
const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data;
}

async function analyzeFullDay(symbol) {
    const today = new Date().toISOString().split('T')[0];
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
    if (!res.dataset) return;

    console.log(`\n--- Full Day Analysis for ${symbol} ---`);
    const orb5mHigh = res.dataset[0][2];
    console.log(`ORB 5m High: ${orb5mHigh}`);

    res.dataset.forEach(row => {
        const time = new Date(row[0]).toLocaleTimeString('en-US', { hour12: false });
        const close = row[4];
        const volume = row[5];
        const status = row[2] > orb5mHigh ? 'BO' : '  ';
        console.log(`${time}\tPrice: ${close.toFixed(2)}\tVol: ${volume.toLocaleString()}\t${status}`);
    });
}

const symbol = process.argv[2] || 'YOUW';
analyzeFullDay(symbol).catch(console.error);

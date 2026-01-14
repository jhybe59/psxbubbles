// Node 24 has built-in fetch
const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data;
}

async function main() {
    const today = new Date().toISOString().split('T')[0];

    // Find symbols that hit a high but closed much lower
    const sql = `
        SELECT symbol, max(price) as h, last(price) as c, first(price) as o
        FROM trades
        WHERE timestamp >= '${today}'
        GROUP BY symbol
        HAVING (max(price) - last(price)) / max(price) > 0.02 -- Dropped > 2% from high
           AND max(price) > first(price) -- Was up
    `;
    const res = await query(sql);
    if (!res.dataset) return;

    console.log("Potential Traps/Fakeouts Today:");
    res.dataset.forEach(r => {
        const drop = ((r[1] - r[2]) / r[1] * 100).toFixed(2);
        const gain = ((r[2] - r[3]) / r[3] * 100).toFixed(2);
        console.log(`${r[0]}\tHigh: ${r[1]}\tClose: ${r[2]}\tDrop: ${drop}%\tFinal Gain: ${gain}%`);
    });
}

main().catch(console.error);

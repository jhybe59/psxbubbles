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

    // Find symbols with > 4% range between high and low today
    const sql = `
        SELECT symbol, min(price) as l, max(price) as h, first(price) as o, last(price) as c
        FROM trades
        WHERE timestamp >= '${today}'
        GROUP BY symbol
        HAVING (max(price) - min(price)) / min(price) > 0.04
    `;
    const res = await query(sql);
    if (!res.dataset) {
        console.log("No high-volatility symbols found.");
        return;
    }

    const volMovers = res.dataset.map(r => ({
        symbol: r[0],
        low: r[1],
        high: r[2],
        open: r[3],
        close: r[4],
        range: ((r[2] - r[1]) / r[1] * 100).toFixed(2)
    }));

    console.log(`Found ${volMovers.length} symbols with >4% Intraday Range:`);
    console.log("Symbol\tLow\tHigh\tRange%\tOpen\tClose");
    volMovers.sort((a, b) => b.range - a.range).forEach(m => {
        console.log(`${m.symbol}\t${m.low.toFixed(2)}\t${m.high.toFixed(2)}\t${m.range}%\t${m.open.toFixed(2)}\t${m.close.toFixed(2)}`);
    });
}

main().catch(console.error);

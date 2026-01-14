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

    // Direct aggregate query
    const sql = `
        SELECT symbol, min(price) as l, max(price) as h, first(price) as o, last(price) as c
        FROM trades
        WHERE timestamp >= '${today}'
        GROUP BY symbol
    `;
    const res = await query(sql);
    if (!res.dataset) {
        console.log("No data returned.");
        return;
    }

    const movers = res.dataset.map(r => ({
        symbol: r[0],
        low: r[1],
        high: r[2],
        open: r[3],
        close: r[4],
        range: r[1] > 0 ? ((r[2] - r[1]) / r[1] * 100) : 0
    }));

    const significant = movers.filter(m => m.range > 3.0);
    console.log(`Found ${significant.length} symbols with >3% Intraday Range:`);
    console.log("Symbol\tRange%\tOpen\tLow\tHigh\tClose");
    significant.sort((a, b) => b.range - a.range).forEach(m => {
        console.log(`${m.symbol}\t${m.range.toFixed(2)}%\t${m.open.toFixed(2)}\t${m.low.toFixed(2)}\t${m.high.toFixed(2)}\t${m.close.toFixed(2)}`);
    });
}

main().catch(console.error);

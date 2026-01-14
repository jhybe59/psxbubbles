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

    // Simpler query to get all symbols traded today with their range
    const sql = `
        SELECT symbol, first(price) as open, last(price) as close, count() as trades
        FROM trades
        WHERE timestamp >= '${today}'
        SAMPLE BY 1d ALIGN TO CALENDAR
    `;
    const res = await query(sql);
    if (!res.dataset) {
        console.log("No dataset returned from QuestDB.");
        return;
    }

    const movers = res.dataset.map(r => {
        const symbol = r[0];
        const open = r[1];
        const close = r[2];
        const pct = open > 0 ? ((close - open) / open) * 100 : 0;
        return { symbol, open, close, pct, trades: r[3] };
    });

    console.log("Movers Today (Sorted by % Gain):");
    movers.sort((a, b) => b.pct - a.pct);
    movers.slice(0, 20).forEach(m => {
        console.log(`${m.symbol}\tOpen: ${m.open.toFixed(2)}\tClose: ${m.close.toFixed(2)}\tGain: ${m.pct.toFixed(2)}%\tTrades: ${m.trades}`);
    });
}

main().catch(console.error);


const BASE_URL = 'http://localhost:8080/api/bubbles';

async function fetchInterval(interval) {
    try {
        const res = await fetch(`${BASE_URL}?interval=${interval}&limit=5`, {
            headers: { 'x-api-key': 'dev-api-key' }
        });
        if (!res.ok) {
            console.error(`Failed to fetch ${interval}: ${res.status} ${res.statusText}`);
            return null;
        }
        const data = await res.json();
        return data;
    } catch (err) {
        console.error(`Error fetching ${interval}:`, err.message);
        return null;
    }
}

async function main() {
    console.log('Fetching 1m data...');
    const data1m = await fetchInterval('1m');

    console.log('Fetching 5m data...');
    const data5m = await fetchInterval('5m');

    if (!data1m || !data5m) {
        console.error('Failed to fetch data.');
        return;
    }

    console.log('\n--- Comparison ---');
    console.log(`1m AsOf: ${data1m.asOf}`);
    console.log(`5m AsOf: ${data5m.asOf}`);

    const symbols1m = new Map(data1m.symbols.map(s => [s.symbol, s]));
    const symbols5m = new Map(data5m.symbols.map(s => [s.symbol, s]));

    // Find common symbols
    const common = data1m.symbols.filter(s => symbols5m.has(s.symbol)).slice(0, 5);

    if (common.length === 0) {
        console.log('No common symbols found in top 5.');
        // Try to find any common symbol
        const anyCommon = data1m.symbols.find(s => symbols5m.has(s.symbol));
        if (anyCommon) {
            common.push(anyCommon);
        }
    }

    for (const s1 of common) {
        const s5 = symbols5m.get(s1.symbol);
        console.log(`\nSymbol: ${s1.symbol}`);
        console.log(`  1m TS: ${new Date(s1.ts).toISOString()} (${s1.ts})`);
        console.log(`  5m TS: ${new Date(s5.ts).toISOString()} (${s5.ts})`);
        console.log(`  Diff: ${(s1.ts - s5.ts) / 1000} seconds`);
        console.log(`  1m Price: ${s1.price}`);
        console.log(`  5m Price: ${s5.price}`);
    }
}

main();

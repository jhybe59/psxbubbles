
const LIVE_API_BASE_URL = 'http://localhost:8080/api';

async function testFrontendLogic() {
    try {
        const url = `${LIVE_API_BASE_URL}/bubbles?interval=Day`;
        console.log(`Fetching ${url}...`);
        const res = await fetch(url, { headers: { 'x-api-key': 'dev-api-key' } });
        const json = await res.json();

        console.log('Response structure keys:', Object.keys(json));
        if (json.meta) console.log('Meta:', json.meta);
        if (json.data && json.data.length > 0) console.log('First item keys:', Object.keys(json.data[0]));

        // Emulate useOHLCV logic
        const symbols = json.symbols || json.data;
        if (!json || !Array.isArray(symbols)) {
            console.log('No symbols array found');
            return;
        }

        console.log(`Processing ${symbols.length} symbols...`);

        const mapped = symbols.map((row) => {
            // Line 153
            const price = Number(row.price ?? row.close ?? 0);
            const open = row.open != null ? Number(row.open) : (row.price || 0);
            const high = row.high != null ? Number(row.high) : (row.price || 0);
            const low = row.low != null ? Number(row.low) : (row.price || 0);

            // Line 158
            const changePct = Number(row.intervalPct ?? row.pct_interval ?? 0);

            const prevClose = price / (1 + changePct / 100);

            return {
                symbol: row.symbol,
                price: price,
                change: changePct,
                daily: row.dailyPct != null ? Number(row.dailyPct) : (row.pct_24h != null ? Number(row.pct_24h) : null)
            };
        });

        console.log('Mapping successful. Sample:', mapped[0]);

    } catch (error) {
        console.error('CRASHED:', error);
    }
}

testFrontendLogic();

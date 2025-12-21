
const API_URL = 'http://127.0.0.1:8080/api/bubbles';

async function testApi() {
    console.log('--- Testing API RVOL ---');

    const intervals = ['1h', 'Day', '100t'];

    for (const interval of intervals) {
        let url = `${API_URL}?interval=${interval}`;
        if (interval === '100t') {
            url = `http://127.0.0.1:8080/api/tick-bubbles?ticks=100`;
        }

        console.log(`\nFetching ${url}...`);
        try {
            const res = await fetch(url, {
                headers: { 'x-api-key': 'dev-api-key' }
            });
            if (!res.ok) {
                console.error(`Status: ${res.status}`);
                const txt = await res.text();
                console.error('Body:', txt.substring(0, 200));
                continue;
            }

            const json = await res.json();
            const data = Array.isArray(json) ? json : json.data;

            if (!data || data.length === 0) {
                console.log('No data returned');
                continue;
            }

            console.log(`Count: ${data.length}`);
            const sample = data.find(d => d.symbol === 'TRSM') || data[0];
            console.log('Sample Symbol:', sample.symbol);
            console.log('RVOL:', sample.rvol);

            // Check how many have non-zero RVOL
            const nonZero = data.filter(d => d.rvol > 0).length;
            console.log(`Non-Zero RVOL: ${nonZero} / ${data.length}`);

            // Check distribution
            const avgRvol = data.reduce((s, d) => s + (d.rvol || 0), 0) / data.length;
            console.log(`Avg RVOL: ${avgRvol.toFixed(4)}`);

        } catch (err) {
            console.error('Fetch Failed:', err.message);
        }
    }
}

testApi();

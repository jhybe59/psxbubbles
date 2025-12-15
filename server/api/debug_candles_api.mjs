import fetch from 'node-fetch';

async function run() {
    try {
        const symbol = 'NETSOL';
        const url = `http://localhost:8080/api/candles?symbol=${symbol}&interval=1m&limit=10`;
        console.log('Fetching:', url);

        const res = await fetch(url);
        const json = await res.json();

        console.log('Response:', JSON.stringify(json, null, 2));
    } catch (e) {
        console.error(e);
    }
}

run();

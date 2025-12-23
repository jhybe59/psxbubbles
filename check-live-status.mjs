const API_URL = 'https://psxbubbles.up.railway.app/api/bubbles?interval=1m';
const API_KEY = 'dev-api-key'; // It might be protected now, but usually GET is public or needs key. 
// Actually, usually public GET doesn't need key? Or does it?
// Based on local testing, we used x-api-key. The live one uses headers.

async function main() {
    console.log('Checking API:', API_URL);
    try {
        const res = await fetch(API_URL, {
            headers: { 'x-api-key': 'your-secure-api-key' } // I don't know the live key. 
            // But usually browser requests work?
            // If I don't have the key, I will get 401. 500 is the error we are looking for.
        });

        console.log(`Status: ${res.status} ${res.statusText}`);
        if (!res.ok) {
            const txt = await res.text();
            console.log('Body:', txt.slice(0, 500));
        } else {
            const json = await res.json();
            console.log(`Success! Got ${json.length} symbols.`);
        }
    } catch (err) {
        console.error('Network Error:', err.message);
    }
}

main();

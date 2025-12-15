
import http from 'http';

const symbol = 'LUCK';
const interval = '10T';

const options = {
    hostname: 'localhost',
    port: 8080,
    path: `/api/tick-candles?symbol=${symbol}&interval=${interval}&limit=5`,
    method: 'GET',
    headers: {
        'x-api-key': 'dev-api-key'
        // Wait, let's check config for api key or if it's open.
        // The previous app.mjs showed apiKeyMiddleware. 
    }
};

// I need the API key. Let's try without first, or read from env.
// Actually app.mjs said: if (!config.apiKeys.primary && !config.apiKeys.secondary) return next();
// I'll check .env if the request fails.

const req = http.request(options, res => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers:`, res.headers);
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.log("Response not JSON:", data);
        }
    });
});

req.on('error', error => {
    console.error(error);
});

req.end();


import http from 'http';

const symbol = 'GHNI';
const interval = '1000T';

const options = {
    hostname: 'localhost',
    port: 8080,
    path: `/api/tick-candles?symbol=${symbol}&interval=${interval}&limit=100`,
    method: 'GET',
    headers: {
        'x-api-key': 'dev-api-key'
    }
};

console.log(`Requesting ${options.path}...`);

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

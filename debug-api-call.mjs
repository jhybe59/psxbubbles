
import http from 'http';

function checkApi() {
    const options = {
        hostname: 'localhost',
        port: 8080,
        path: '/api/tick-bubbles?ticks=100',
        method: 'GET',
        headers: {
            'x-api-key': 'dev-api-key'
        }
    };

    console.log(`Fetching http://localhost:8080${options.path}...`);

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                if (res.statusCode !== 200) {
                    console.error(`Status Code: ${res.statusCode}`);
                    console.log('Response:', data.substring(0, 200));
                    return;
                }
                const json = JSON.parse(data);
                console.log(`Got ${json.length} items`);
                if (json.length === 0) return;

                const sample = json.find(i => i.rvol > 0);
                if (sample) {
                    console.log('Sample with RVOL:', JSON.stringify(sample, null, 2));
                    // Check if rvol matches legacy relative_volume just in case
                    console.log(`Checking match for ${sample.symbol}: rvol=${sample.rvol}, relative_volume=${sample.relative_volume}`);
                } else {
                    console.log('NO items with rvol > 0 found. First item:', JSON.stringify(json[0], null, 2));
                }
            } catch (e) {
                console.error('Parse error:', e.message);
                console.log('Raw data start:', data.substring(0, 100));
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    req.end();
}

checkApi();

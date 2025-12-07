import http from 'http';

const fetch = (url) => {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const options = {
            headers: {
                'x-api-key': 'dev-api-key'
            }
        };
        http.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const duration = Date.now() - start;
                try {
                    const json = JSON.parse(data);
                    resolve({ duration, status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ duration, status: res.statusCode, error: e.message, raw: data.substring(0, 100) });
                }
            });
        }).on('error', reject);
    });
};

const run = async () => {
    console.log('Testing TimescaleDB endpoint...');
    try {
        const ts = await fetch('http://localhost:8080/api/bubbles?interval=1m&limit=10');
        console.log(`TimescaleDB: Status ${ts.status}, Duration ${ts.duration}ms`);
        if (ts.data && ts.data.symbols) {
            console.log(`TimescaleDB Symbols: ${ts.data.symbols.length}`);
            console.log('Sample:', ts.data.symbols[0]);
        } else {
            console.log('TimescaleDB Error:', ts);
        }
    } catch (err) {
        console.error('TimescaleDB Request Failed:', err.message);
    }

    console.log('\nTesting QuestDB endpoint...');
    try {
        const qdb = await fetch('http://localhost:8080/api/bubbles-quest?interval=1m&limit=10');
        console.log(`QuestDB: Status ${qdb.status}, Duration ${qdb.duration}ms`);
        if (qdb.data && qdb.data.symbols) {
            console.log(`QuestDB Symbols: ${qdb.data.symbols.length}`);
            console.log('Sample:', qdb.data.symbols[0]);
        } else {
            console.log('QuestDB Error:', qdb);
        }
    } catch (err) {
        console.error('QuestDB Request Failed:', err.message);
    }
};

run();

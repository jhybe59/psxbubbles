import http from 'http';

const query = (sql) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 9000,
            path: `/exec?query=${encodeURIComponent(sql)}`,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                console.log(`Response: ${data}`);
                resolve();
            });
        });

        req.on('error', reject);
        req.end();
    });
};

const run = async () => {
    console.log('Creating table minute_bars...');
    const sql = `CREATE TABLE IF NOT EXISTS minute_bars (
    symbol SYMBOL, 
    open DOUBLE, 
    high DOUBLE, 
    low DOUBLE, 
    close DOUBLE, 
    volume DOUBLE, 
    value DOUBLE, 
    daily_pct DOUBLE, 
    ts TIMESTAMP
  ) TIMESTAMP(ts) PARTITION BY DAY WAL`;

    await query(sql);
};

run();

import http from 'http';
import 'dotenv/config';

const HOST = process.env.QUESTDB_HOST || 'localhost';
const PORT = process.env.QUESTDB_HTTP_PORT || 9000;

const query = (sql) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            port: PORT,
            path: `/exec?query=${encodeURIComponent(sql)}`,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                console.log(`Response: ${data}`);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                } else {
                    reject(new Error(`Query failed with status ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
};

const run = async () => {
    console.log(`Connecting to QuestDB at ${HOST}:${PORT}...`);

    console.log('Creating table minute_bars...');
    // Added tick_seq to match worker's ingestion logic
    const sqlMinuteBars = `CREATE TABLE IF NOT EXISTS minute_bars (
    symbol SYMBOL, 
    open DOUBLE, 
    high DOUBLE, 
    low DOUBLE, 
    close DOUBLE, 
    volume DOUBLE, 
    value DOUBLE, 
    daily_pct DOUBLE,
    tick_seq LONG,
    ts TIMESTAMP
  ) TIMESTAMP(ts) PARTITION BY DAY WAL`;

    try {
        await query(sqlMinuteBars);
        console.log('Table minute_bars created (or exists).');
    } catch (e) {
        console.error('Failed to create minute_bars:', e.message);
    }

    console.log('Creating table trades...');
    const sqlTrades = `CREATE TABLE IF NOT EXISTS trades (
    symbol SYMBOL, 
    price DOUBLE, 
    volume DOUBLE, 
    value DOUBLE, 
    daily_pct DOUBLE,
    tick_seq LONG,
    ts TIMESTAMP
  ) TIMESTAMP(ts) PARTITION BY DAY WAL`;

    try {
        await query(sqlTrades);
        console.log('Table trades created (or exists).');
    } catch (e) {
        console.error('Failed to create trades:', e.message);
    }
};

run();


import http from 'http';

function query(sql) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:9000/exec?query=${encodeURIComponent(sql)}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.error("Failed to parse", data);
                    resolve({});
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    try {
        console.log('Fetching PPL trades...');
        const trades = await query("select * from trades where symbol='PPL' order by timestamp desc limit 5");
        if (trades.dataset) {
            console.log('Trades Columns:', trades.columns.map(c => c.name));
            trades.dataset.forEach(row => console.log('Trade:', row));
        }

        console.log('Fetching PPL minute_bars...');
        const bars = await query("select * from minute_bars where symbol='PPL' order by timestamp desc limit 5");
        if (bars.dataset) {
            console.log('Bars Columns:', bars.columns.map(c => c.name));
            bars.dataset.forEach(row => console.log('Bar:', row));
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

run();

const http = require('http');

function query(sql) {
    const url = `http://localhost:9000/exec?query=${encodeURIComponent(sql)}`;
    http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            console.log(sql, ':', data);
        });
    }).on('error', (err) => {
        console.error('Error:', err.message);
    });
}

query('TRUNCATE TABLE market_features');
query('TRUNCATE TABLE ml_predictions');

const http = require('http');

function query(sql) {
    const url = `http://localhost:9000/exec?query=${encodeURIComponent(sql)}`;
    http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.json(data);
                console.log(sql, ':', json.dataset[0][0]);
            } catch (e) {
                console.log(sql, ':', data);
            }
        });
    }).on('error', (err) => {
        console.error('Error:', err.message);
    });
}

query('select count() from market_features');
query('select count() from ml_predictions');

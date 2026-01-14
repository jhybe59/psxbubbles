import https from 'node:https';

const URL = 'https://questdb-production-ec9c.up.railway.app/exec?query=' + encodeURIComponent("SELECT count() FROM trades WHERE timestamp >= '2026-01-08T04:00:00.000Z'") + '&count=true';

https.get(URL, { rejectUnauthorized: false }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try { const json = JSON.parse(data); console.log('Total trades today:', json?.dataset?.[0]?.[0]); }
        catch (e) { console.error('Parse error', e); }
    });
}).on('error', e => console.error('Error', e));

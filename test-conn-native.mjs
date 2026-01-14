import https from 'node:https';

const url = 'https://questdb-production-ec9c.up.railway.app/exec?query=SELECT+count()+FROM+trades';
console.log('Testing connection to:', url);

https.get(url, { rejectUnauthorized: false }, (res) => {
    console.log('StatusCode:', res.statusCode);
    console.log('Headers:', res.headers);

    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Body:', data.substring(0, 500));
    });
}).on('error', (e) => {
    console.error('Error:', e);
});

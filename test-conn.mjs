import https from 'node:https';
import fetch from 'node-fetch'; // Try importing, fallback to global if needed

const agent = new https.Agent({
    rejectUnauthorized: false
});

const URL = 'https://questdb-production-ec9c.up.railway.app/exec?query=SELECT+count()+FROM+trades';

console.log('Testing connection to:', URL);

try {
    const response = await fetch(URL, { agent });
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Body:', text.substring(0, 200));
} catch (error) {
    console.error('Connection failed:', error.message);
    if (error.cause) console.error('Cause:', error.cause);
}

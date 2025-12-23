const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function query(sql) {
    console.log(`Executing: ${sql}`);
    const res = await fetch(`${QUESTDB_URL}?query=${encodeURIComponent(sql)}`);
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Query failed: ${res.status} ${res.statusText} - ${txt}`);
    }
    return res.json();
}

async function main() {
    try {
        console.log('Dropping table minute_bars...');
        await query('DROP TABLE minute_bars');
        console.log('✅ Success! Table dropped. RAM should free up shortly.');
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

main();

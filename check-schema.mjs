const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function main() {
    try {
        const res = await fetch(`${QUESTDB_URL}?query=SHOW+COLUMNS+FROM+trades`);
        const json = await res.json();
        console.table(json.dataset);
    } catch (err) {
        console.error(err.message);
    }
}

main();

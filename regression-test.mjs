
import fs from 'fs';

const BASE_URL = 'http://localhost:8080/api/bubbles'; // Adjust if needed
const SNAPSHOT_FILE = 'bubbles_snapshot.json';

async function getBubbles(interval = 'Day') {
    const res = await fetch(`${BASE_URL}?interval=${interval}&limit=10`, {
        headers: {
            'x-api-key': 'dev-api-key'
        }
    });
    if (!res.ok) {
        const text = await res.text();
        console.error(`API Error [${interval}]: ${res.status} ${res.statusText}\nBody: ${text}`);
    }
    return res.json();
}

async function createSnapshot() {
    console.log('Creating baseline snapshot...');
    const intervals = ['1m', '5m', 'Day'];
    const snapshots = {};

    for (const interval of intervals) {
        snapshots[interval] = await getBubbles(interval);
    }

    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshots, null, 2));
    console.log(`Snapshot saved to ${SNAPSHOT_FILE}`);
}

async function verifySnapshot() {
    if (!fs.existsSync(SNAPSHOT_FILE)) {
        console.error('No snapshot found! Run with --create first.');
        return;
    }

    console.log('Verifying current response against snapshot...');
    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
    const intervals = Object.keys(snapshot);
    let passes = 0;
    let fails = 0;

    for (const interval of intervals) {
        const current = await getBubbles(interval);
        const old = snapshot[interval];

        if (current.data.length !== old.data.length) {
            console.warn(`[${interval}] Count mismatch: OLD=${old.data.length}, NEW=${current.data.length}`);
        }

        // Compare key metrics for the first few symbols
        const count = Math.min(current.data.length, 3);
        for (let i = 0; i < count; i++) {
            const sOld = old.data[i];
            const sNew = current.data.find(d => d.symbol === sOld.symbol);

            if (!sNew) {
                console.error(`[${interval}] Symbol ${sOld.symbol} missing in new response!`);
                fails++;
                continue;
            }

            const metrics = ['price', 'pct_interval', 'pct_24h', 'rvol', 'squeeze_on'];
            let symbolPass = true;
            for (const metric of metrics) {
                if (sOld[metric] !== sNew[metric]) {
                    // Check for negligible floating point difference
                    if (typeof sOld[metric] === 'number' && Math.abs(sOld[metric] - sNew[metric]) < 0.0001) {
                        continue;
                    }
                    console.warn(`[${interval}] ${sOld.symbol} ${metric} mismatch: OLD=${sOld[metric]}, NEW=${sNew[metric]}`);
                    symbolPass = false;
                }
            }
            if (symbolPass) passes++; else fails++;
        }
    }

    console.log(`--- Results: ${passes} matches, ${fails} mismatches ---`);
}

const args = process.argv.slice(2);
if (args.includes('--create')) {
    createSnapshot();
} else {
    verifySnapshot();
}

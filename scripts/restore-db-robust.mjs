import { execSync } from 'child_process';

const run = (cmd) => {
    console.log(`Running: ${cmd}`);
    try {
        execSync(cmd, { stdio: 'inherit' });
    } catch (err) {
        console.error(`Command failed: ${cmd}`);
        process.exit(1);
    }
};

const execDb = (sql) => {
    run(`docker exec my-cryptobubbles-timescale-1 psql -U postgres -d cryptobubbles -c "${sql}"`);
};

const waitForDb = () => {
    console.log('Waiting for DB...');
    let retries = 30;
    while (retries > 0) {
        try {
            execSync('docker exec my-cryptobubbles-timescale-1 pg_isready -U postgres', { stdio: 'ignore' });
            console.log('DB is ready.');
            return;
        } catch (e) {
            console.log('DB not ready, waiting...');
            execSync('timeout 2 >nul 2>&1 || ping -n 3 127.0.0.1 >nul'); // Sleep 2s
            retries--;
        }
    }
    console.error('DB timed out.');
    process.exit(1);
};

const main = () => {
    // 1. Wipe and Restart
    console.log('--- Resetting Stack ---');
    run('docker compose -f docker-compose.dev.yml --env-file config/dev.env down -v');
    run('docker compose -f docker-compose.dev.yml --env-file config/dev.env up -d');

    // 2. Wait for DB
    waitForDb();
    // Give it a few more seconds to be really ready for connections
    execSync('timeout 5 >nul 2>&1 || ping -n 6 127.0.0.1 >nul');

    // 3. Prepare DB
    console.log('--- Preparing DB ---');
    execDb('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;');
    execDb('SELECT timescaledb_pre_restore();');

    // 4. Copy Backup
    console.log('--- Copying Backup ---');
    run('docker cp complete-backup-2025-12-05_14-23-32/timescale-backup.dump my-cryptobubbles-timescale-1:/tmp/backup.dump');

    // 5. Restore
    console.log('--- Restoring Data ---');
    try {
        // pg_restore might return 1 on warnings, so we wrap it
        execSync('docker exec my-cryptobubbles-timescale-1 pg_restore -U postgres -d cryptobubbles -v --if-exists /tmp/backup.dump', { stdio: 'inherit' });
    } catch (e) {
        console.log('pg_restore finished with exit code (likely warnings). Continuing...');
    }

    // 6. Post Restore
    console.log('--- Post Restore ---');
    execDb('SELECT timescaledb_post_restore();');

    // 7. Verify
    console.log('--- Verifying ---');
    execDb('SELECT count(*) FROM minute_bars;');
};

main();

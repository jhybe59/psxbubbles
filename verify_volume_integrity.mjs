import { queryQuestDB } from './server/api/questdb.mjs';

async function verifyVolume() {
    console.log("Starting Volume Integrity Check (Revised)...");

    // 1. Check Max Timestamp
    const maxRes = await queryQuestDB("SELECT max(timestamp) FROM trades");
    if (!maxRes || !maxRes.dataset || !maxRes.dataset[0][0]) {
        console.error("❌ Stats: Trades table appears EMPTY.");
        return;
    }

    const maxTs = maxRes.dataset[0][0];
    console.log(`Latest Trade Timestamp: ${maxTs}`);

    // 2. Adjust query to look at the day of the latest data
    const datePart = maxTs.split('T')[0]; // YYYY-MM-DD

    // Pakistan Market Open is 04:00 UTC. 
    // If maxTs is before 04:00 UTC, we should look at previous day? 
    // Let's just look at the 24h window ending at maxTs for simplicity of 'integrity' check

    console.log(`Verifying volume for 24h ending at ${maxTs}...`);

    const symbolsRes = await queryQuestDB(`SELECT DISTINCT symbol FROM trades WHERE timestamp > dateadd('h', -1, '${maxTs}'::timestamp) LIMIT 5`);
    if (!symbolsRes || !symbolsRes.dataset) {
        console.log("No symbols found in recent window.");
        return;
    }
    const symbols = symbolsRes.dataset.map(r => r[0]);
    console.log(`Checking symbols: ${symbols.join(', ')}`);

    for (const symbol of symbols) {
        console.log(`\n--- Verifying ${symbol} ---`);

        // A. Raw Volume in last 24h
        const rawSql = `
            SELECT sum(volume) 
            FROM trades 
            WHERE symbol = '${symbol}' 
            AND timestamp > dateadd('d', -1, '${maxTs}'::timestamp)
            AND timestamp <= '${maxTs}'::timestamp
        `;
        const rawRes = await queryQuestDB(rawSql);
        const rawVol = rawRes.dataset[0][0];

        // B. Sampled 1m Volume
        const sampledSql = `
            SELECT sum(vol_1m) FROM (
                SELECT sum(volume) as vol_1m
                FROM trades
                WHERE symbol = '${symbol}'
                AND timestamp > dateadd('d', -1, '${maxTs}'::timestamp)
                AND timestamp <= '${maxTs}'::timestamp
                SAMPLE BY 1m ALIGN TO CALENDAR
            )
        `;
        const sampledRes = await queryQuestDB(sampledSql);
        const sampledVol = sampledRes.dataset[0][0];

        console.log(`Raw Trade Volume:   ${rawVol}`);
        console.log(`Sampled 1m Volume:  ${sampledVol}`);

        const diff = Math.abs(rawVol - sampledVol);
        if (diff > 0.001) {
            console.error(`❌ MISMATCH: Difference of ${diff}`);
        } else {
            console.log(`✅ MATCH`);
        }
    }
}

verifyVolume().catch(console.error).finally(() => process.exit());

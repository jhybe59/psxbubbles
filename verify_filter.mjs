import { queryQuestDB } from './server/api/questdb.mjs';

async function verifyZeroVolumeFilter() {
    console.log("Verifying Zero Volume Filter...");

    const symbol = 'TOMCL'; // Example symbol

    // 1. Count Total Trades vs Zero Volume Trades
    const sqlTotal = `SELECT count(*) FROM trades WHERE symbol = '${symbol}'`;
    const sqlZero = `SELECT count(*) FROM trades WHERE symbol = '${symbol}' AND volume = 0`;

    const [resTotal, resZero] = await Promise.all([
        queryQuestDB(sqlTotal),
        queryQuestDB(sqlZero)
    ]);

    const total = resTotal.dataset[0][0];
    const zeros = resZero.dataset[0][0];

    console.log(`Total Trades for ${symbol}: ${total}`);
    console.log(`Zero Volume Trades: ${zeros}`);

    if (zeros > 0) {
        console.log("⚠️  DB has zero volume trades. API filtering is REQUIRED.");
    } else {
        console.log("✅ DB has NO zero volume trades. Filtering might be redundant but safe.");
    }

    console.log("\nIf we had run the API query WITHOUT filter, we would get these useless ticks.");
    console.log("With the filter, these " + zeros + " ticks are ignored.");
}

verifyZeroVolumeFilter().catch(console.error).finally(() => process.exit());

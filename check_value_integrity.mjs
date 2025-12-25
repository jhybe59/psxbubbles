import { queryQuestDB } from './server/api/questdb.mjs';

async function checkValueAndPct() {
    console.log("Checking 'value' and 'daily_pct' columns...");

    const sql = `
        SELECT symbol, price, volume, value, daily_pct 
        FROM trades 
        WHERE timestamp > dateadd('d', -2, now()) 
        LIMIT 10
    `;

    const res = await queryQuestDB(sql);
    if (!res || !res.dataset) {
        console.log("No recent data found.");
        return;
    }

    console.log("Symbol | Price | Volume | DB Value | Calculated (P*V) | DailyPct");
    console.log("-------|-------|--------|----------|------------------|----------");

    for (const row of res.dataset) {
        const [sym, price, vol, val, pct] = row;
        const calcVal = price * vol;
        const diff = Math.abs(val - calcVal);
        const match = diff < 1.0 ? "✅" : "❌"; // Allow small float diff

        console.log(`${sym.padEnd(6)} | ${price.toFixed(2).padEnd(5)} | ${vol.toString().padEnd(6)} | ${val.toFixed(2).padEnd(8)} | ${calcVal.toFixed(2).padEnd(16)} ${match} | ${pct}`);
    }
}

checkValueAndPct().catch(console.error).finally(() => process.exit());

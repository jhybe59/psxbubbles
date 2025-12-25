import { queryQuestDB } from './server/api/questdb.mjs';

async function checkSchema() {
    console.log("Checking 'trades' table schema...");
    const res = await queryQuestDB("SHOW COLUMNS FROM trades");
    if (res && res.dataset) {
        console.table(res.dataset.map(row => ({ column: row[0], type: row[1] })));
    } else {
        console.log("Failed to get schema or table not found.");
    }
}

checkSchema().catch(console.error).finally(() => process.exit());

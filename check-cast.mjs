
import { queryQuestDB } from './server/api/questdb.mjs';

async function checkCasting() {
    const anchorTs = '2025-12-18T10:36:27.000000Z'; // 6 digits for micros
    const sql = `
      SELECT 
        '${anchorTs}'::timestamp as anchor,
        date_trunc('day', '${anchorTs}'::timestamp) as tr
    `;
    const res = await queryQuestDB(sql);
    console.log('Casting:', JSON.stringify(res.dataset, null, 2));
}

checkCasting();

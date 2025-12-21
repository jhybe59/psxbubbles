
import { queryQuestDB } from './server/api/questdb.mjs';

async function checkTimestamps() {
    const anchorTs = '2025-12-18T10:36:27.000000000Z';
    const sql = `
      SELECT 
        to_timestamp('${anchorTs}') as anchor,
        date_trunc('day', to_timestamp('${anchorTs}')) as tr,
        dateadd('h', 4, date_trunc('day', to_timestamp('${anchorTs}'))) as today_open
    `;
    const res = await queryQuestDB(sql);
    console.log('Timestamps:', JSON.stringify(res.dataset, null, 2));
}

checkTimestamps();


import { queryQuestDB } from './server/api/questdb.mjs';

async function debugPrevStats() {
    const anchorTs = '2025-12-18T10:36:27.000000000Z';
    const todayOpen = `dateadd('h', 4, date_trunc('day', to_timestamp('${anchorTs}')))`;

    const sql = `
      SELECT 
        symbol,
        max(high) as prev_high,
        last(close) as prev_close,
        min(timestamp) as min_ts,
        max(timestamp) as max_ts,
        count(*)
      FROM minute_bars
      WHERE timestamp >= dateadd('d', -7, ${todayOpen})
        AND timestamp < ${todayOpen}
        AND symbol = 'SYS'
      GROUP BY symbol
    `;

    console.log('Running query...');
    const res = await queryQuestDB(sql);
    console.log('Result:', JSON.stringify(res.dataset, null, 2));
}

debugPrevStats();

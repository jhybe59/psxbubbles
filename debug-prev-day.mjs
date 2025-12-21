
import { queryQuestDB } from './server/api/questdb.mjs';

async function testPrevDay() {
    const anchorTs = '2025-12-18T10:36:27.000000Z';
    const todayOpen = `dateadd('h', 4, date_trunc('day', to_timestamp('${anchorTs}')))`;

    const sql = `
      SELECT 
        symbol,
        max(high) as prev_high,
        last(close) as prev_close,
        count() as count
      FROM minute_bars
      WHERE timestamp >= dateadd('d', -7, ${todayOpen})
        AND timestamp < ${todayOpen}
        AND symbol = 'LUCK'
      GROUP BY symbol
    `;

    const res = await queryQuestDB(sql);
    console.log('Prev Day Stats for LUCK:', JSON.stringify(res.dataset, null, 2));

    // Check what data exists just before todayOpen
    const checkSql = `
      SELECT timestamp, close 
      FROM minute_bars 
      WHERE symbol = 'LUCK' AND timestamp < ${todayOpen}
      ORDER BY timestamp DESC
      LIMIT 5
    `;
    const checkRes = await queryQuestDB(checkSql);
    console.log('Data before todayOpen:', JSON.stringify(checkRes.dataset, null, 2));
}

testPrevDay();

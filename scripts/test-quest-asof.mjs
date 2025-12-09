
import { queryQuestDB } from '../server/api/questdb.mjs';

async function testQuery() {
    const intervalMinutes = 5;

    // QuestDB SQL with ASOF JOIN
    // We construct 'targets' with the desired lookup timestamp (ts - 5m)
    // Then ASOF JOIN back to minute_bars to get the price at that time
    const sql = `
    WITH latest AS (
      SELECT symbol, timestamp, close
      FROM minute_bars
      LATEST ON timestamp PARTITION BY symbol
    ),
    targets AS (
      SELECT symbol, dateadd('m', -${intervalMinutes}, timestamp) as target_ts, close as current_price, timestamp as current_ts
      FROM latest
    )
    SELECT
      t.symbol,
      t.current_price,
      m.close as earlier_price,
      m.timestamp as earlier_ts,
      t.current_ts,
      t.target_ts
    FROM targets t
    ASOF JOIN minute_bars m ON (t.symbol = m.symbol AND m.timestamp = t.target_ts)
    LIMIT 5
  `;

    console.log('Executing SQL:', sql);

    try {
        const result = await queryQuestDB(sql);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Query Failed:', err);
    }
}

testQuery();

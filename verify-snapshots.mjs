
import { queryQuestDB } from './server/api/questdb.mjs';

const intervalMap = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1h',
    'Day': '1d'
};

const snapshotSqlQuest = (interval, indexFilter) => {
    const sampleBy = intervalMap[interval] || '1d';
    const lookback = interval === 'Day' ? '7d' : '24h';

    const indexClause = indexFilter ? `AND symbol IN (SELECT symbol FROM index_members WHERE index_code = '${indexFilter}')` : '';

    const cte = `
    WITH latest_candles AS (
      SELECT 
        symbol,
        first(price) as open,
        last(price) as close,
        sum(volume) as vol,
        sum(value) as val,
        timestamp
      FROM trades
      WHERE timestamp >= dateadd('${lookback.endsWith('d') ? 'd' : 'h'}', -${parseInt(lookback)}, now())
        ${indexClause}
      SAMPLE BY ${sampleBy} ALIGN TO CALENDAR
    ),
    latest_final AS (
      SELECT * FROM latest_candles LATEST ON timestamp PARTITION BY symbol
    )
    SELECT
      count() as total,
      sum(case when close > open then 1 else 0 end) as advancers,
      sum(case when close < open then 1 else 0 end) as decliners,
      sum(case when close = open then 1 else 0 end) as unchanged,
      sum(vol) as total_volume,
      sum(val) as total_turnover,
      avg( (close - open) / open * 100 ) as avg_move,
      max(close) as high_price,
      min(close) as low_price
    FROM latest_final
    WHERE open > 0
  `;

    return cte;
};

async function verify() {
    try {
        console.log('Testing Day Snapshot Query...');
        const sql = snapshotSqlQuest('Day');
        const res = await queryQuestDB(sql);
        console.log('Snapshot Result:', JSON.stringify(res, null, 2));

    } catch (err) {
        console.error('Snapshot verification failed:', err);
    }
}

verify();

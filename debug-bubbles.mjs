
import { queryQuestDB } from './server/api/questdb.mjs';

const interval = 'Day';
const latestTs = new Date().toISOString();
const anchorTs = latestTs;
const todayOpen = `dateadd('h', 4, date_trunc('day', '${anchorTs}'::timestamp))`;
const minutesMap = { 'Day': 0 };
const minutes = 0;
const isDay = true;
const symbolFilter = '';

const timeCondition = `timestamp >= ${todayOpen}`;

// Updated SQL logic mirroring bubbles.mjs optimization
const sql = `
    WITH day_vols AS (
      SELECT symbol, sum(volume) as day_volume
      FROM trades
      WHERE timestamp >= ${todayOpen}
      GROUP BY symbol
    ),
    day_agg AS (
      SELECT 
        symbol,
        max(price) as day_high,
        min(price) as day_low
      FROM trades
      WHERE timestamp >= ${todayOpen}
      GROUP BY symbol
    ),
    window_agg AS (
      SELECT 
        symbol,
        first(price) as first_open,
        max(price) as high,
        min(price) as low,
        sum(volume) as volume,
        sum(value) as value
      FROM trades
      WHERE ${timeCondition}
      GROUP BY symbol
    ),
    latest_l AS (
      SELECT symbol, timestamp as ts, last(price) as close
      FROM trades
      WHERE timestamp >= dateadd('d', -7, '${anchorTs}'::timestamp) 
      SAMPLE BY 1m ALIGN TO CALENDAR
    ),
    latest_ordered AS (
      SELECT * FROM latest_l LATEST ON ts PARTITION BY symbol
    ),
    baseline_ordered AS (
      -- Optimized: Direct LATEST ON lookup for baseline price
      SELECT symbol, timestamp, price as baseline_close
      FROM trades
      WHERE timestamp <= dateadd('m', -${minutes}, '${anchorTs}'::timestamp)
        AND timestamp >= dateadd('d', -7, '${anchorTs}'::timestamp)
        ${symbolFilter.replace('WHERE', 'AND')}
      LATEST ON timestamp PARTITION BY symbol
    )
    SELECT 
      l.symbol,
      l.ts,
      COALESCE(b.baseline_close, w.first_open, l.close) as open,
      GREATEST(COALESCE(w.high, l.close), l.close) as high,
      LEAST(COALESCE(w.low, l.close), l.close) as low,
      l.close,
      COALESCE(w.volume, 0) as volume,
      COALESCE(w.value, 0) as value,
      0 as daily_pct,
      COALESCE(dv.day_volume, 0) as day_volume,
      0 as prev_high,
      0 as prev_close,
      da.day_high,
      da.day_low
    FROM latest_ordered l
    LEFT JOIN window_agg w ON l.symbol = w.symbol
    LEFT JOIN baseline_ordered b ON l.symbol = b.symbol
    LEFT JOIN day_vols dv ON l.symbol = dv.symbol
    LEFT JOIN day_agg da ON l.symbol = da.symbol
`;

async function test() {
    try {
        console.log('Testing Optimized Bubbles SQL...');
        const res = await queryQuestDB(sql);
        console.log('Success!', res.count, 'rows');
        if (res.count > 0) console.log('Sample:', res.dataset[0]);

    } catch (err) {
        console.error('SQL Failed:', err);
    }
}

test();

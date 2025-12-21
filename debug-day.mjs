
import { queryQuestDB } from './server/api/questdb.mjs';

async function testDay() {
    // We mimic the logic in buildAggregatedQuery for 'Day'
    const anchorTsRes = await queryQuestDB("SELECT MAX(timestamp) FROM minute_bars");
    const anchorTs = anchorTsRes.dataset[0][0];
    console.log('Anchor TS:', anchorTs);

    const todayOpen = `dateadd('h', 4, date_trunc('day', to_timestamp('${anchorTs}')))`;

    const sql = `
    WITH day_vols AS (
      SELECT symbol, sum(volume) as day_volume
      FROM trades
      WHERE timestamp >= ${todayOpen}
      GROUP BY symbol
    ),
    prev_day_stats AS (
      SELECT 
        symbol,
        max(high) as prev_high,
        last(close) as prev_close
      FROM minute_bars
      WHERE timestamp >= dateadd('d', -7, ${todayOpen})
        AND timestamp < ${todayOpen}
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
        first(open) as first_open,
        max(high) as high,
        min(low) as low,
        sum(volume) as volume,
        sum(value) as value
      FROM minute_bars
      WHERE timestamp >= ${todayOpen}
      GROUP BY symbol
    )
    SELECT 
      l.symbol,
      l.ts,
      COALESCE(w.first_open, l.close) as open,
      l.close,
      pds.prev_close
    FROM (
      SELECT symbol, timestamp as ts, close, daily_pct
      FROM minute_bars
      LATEST ON timestamp PARTITION BY symbol
    ) l
    LEFT JOIN window_agg w ON l.symbol = w.symbol
    LEFT JOIN prev_day_stats pds ON l.symbol = pds.symbol
    WHERE l.symbol = 'LUCK'
  `;

    const res = await queryQuestDB(sql);
    console.log('LUCK Day Row:', JSON.stringify(res.dataset, null, 2));

    const row = res.dataset[0];
    const close = row[3];
    const open = row[2];
    const prevClose = row[4];

    console.log(`Calculation:`);
    console.log(`  Close: ${close}`);
    console.log(`  Open (at 09:00): ${open}`);
    console.log(`  Prev Close: ${prevClose}`);

    if (prevClose) {
        const pct = ((close - prevClose) / prevClose) * 100;
        console.log(`  Daily Pct ((Close-PrevClose)/PrevClose): ${pct.toFixed(4)}%`);
    }
    const intradayPct = ((close - open) / open) * 100;
    console.log(`  Intraday Pct ((Close-Open)/Open): ${intradayPct.toFixed(4)}%`);
}

testDay();

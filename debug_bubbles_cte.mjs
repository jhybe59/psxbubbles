import { queryQuestDB } from './server/api/questdb.mjs';

async function debugBubblesCTE() {
    console.log("Debugging Bubbles.mjs Tick Query...");

    // 1. Get latest timestamp
    const anchorRes = await queryQuestDB("SELECT MAX(timestamp) FROM trades");
    let latestTs = new Date().toISOString();
    if (anchorRes && anchorRes.dataset && anchorRes.dataset.length > 0 && anchorRes.dataset[0][0]) {
        latestTs = anchorRes.dataset[0][0];
    }
    console.log(`Latest Timestamp: ${latestTs}`);

    const tickSize = 100;
    const datePart = latestTs.split('T')[0];

    // Simulate buildTickQuery from bubbles.mjs
    const sql = `
    WITH latest_ticks AS(
    SELECT 
        symbol,
        timestamp,
        price as open,
        price as high,
        price as low,
        price as close,
        volume,
        value,
        tick_seq,
        (tick_seq / ${tickSize}) as tick_bucket
      FROM trades
      WHERE timestamp > dateadd('h', -168, '${latestTs}'::timestamp)
      -- LIMIT to a few symbols for speed
      AND symbol IN ('TOMCL', 'TRSM') 
    ),
    day_vols AS(
      --Get total SESSION volume from trades(raw tick data)
      --Session starts at 09:00 PKT = 04:00 UTC
      SELECT symbol, sum(volume) as day_volume
      FROM trades
      WHERE timestamp >= dateadd('h', 4, date_trunc('day', '${latestTs}'::timestamp))
      GROUP BY symbol
    )
    SELECT
      l.symbol,
      max(l.timestamp) as ts,
      COALESCE(first(dv.day_volume), 0) as day_volume
    FROM latest_ticks l
    LEFT JOIN day_vols dv ON l.symbol = dv.symbol

    GROUP BY l.symbol, l.tick_bucket
    ORDER BY l.symbol, l.tick_bucket DESC
    LIMIT 20
  `;

    console.log("Executing CTE Query...");
    const res = await queryQuestDB(sql);

    if (!res || !res.dataset) {
        console.log("No result.");
        return;
    }

    console.table(res.dataset.map(r => ({ symbol: r[0], ts: r[1], day_volume: r[2] })));
}

debugBubblesCTE().catch(console.error).finally(() => process.exit());

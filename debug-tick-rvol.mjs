
import { queryQuestDB } from './server/api/questdb.mjs';
import { config } from './server/api/config.mjs';
config.questdb = { host: '127.0.0.1', httpPort: 9000 };

async function debugTickRVOL() {
    console.log('--- Debugging Tick RVOL Query ---');
    const symbol = 'TRSM';
    const tickCount = 100;
    const lookback = 20;

    console.log(`\n--- Tick RVOL Query (${tickCount} ticks) ---`);
    const sql = `
    WITH raw_data AS (
      SELECT 
        symbol,
        volume,
        timestamp,
        row_number() OVER (PARTITION BY symbol ORDER BY timestamp DESC) as trade_rn
      FROM trades
      WHERE symbol = '${symbol}'
    ),
    blocks AS (
      SELECT 
        symbol,
        (trade_rn - 1) / ${tickCount} as block_id,
        sum(volume) as block_vol
      FROM raw_data
      WHERE trade_rn <= ${tickCount * (lookback + 1)}
      GROUP BY symbol, (trade_rn - 1) / ${tickCount}
    ),
    with_avg AS (
      SELECT 
        symbol,
        block_id,
        block_vol,
        avg(block_vol) OVER (PARTITION BY symbol ORDER BY block_id DESC ROWS BETWEEN ${lookback} PRECEDING AND 1 PRECEDING) as avg_block_vol
      FROM blocks
    )
    SELECT * FROM with_avg
    WHERE block_id = 0
    `;

    try {
        const res = await queryQuestDB(sql);
        if (res.dataset.length > 0) {
            console.log('Latest Tick Block:', res.dataset[0]);
            const vol = res.dataset[0][2];
            const avg = res.dataset[0][3];
            console.log(`Tick RVOL = ${vol} / ${avg} = ${avg ? (vol / avg).toFixed(2) : 'NaN'}`);
        } else {
            console.log('No tick data found for latest bucket');
        }
    } catch (err) {
        console.error('Tick Query Failed:', err);
    }
}

debugTickRVOL();


import { queryQuestDB } from './server/api/questdb.mjs';

const sql = `
            WITH candle_data AS (
                SELECT 
                    symbol,
                    timestamp,
                    first(open) as open,
                    max(high) as high,
                    min(low) as low,
                    last(close) as close
                FROM minute_bars
                WHERE symbol IN ('BTCUSDT') AND timestamp > dateadd('d', -5, now())
                SAMPLE BY 1h
            ),
            with_tr AS (
                SELECT *,
                    (high - low) as tr
                FROM candle_data
            ),
            stats AS (
                SELECT *,
                    avg(close) OVER (PARTITION BY symbol ORDER BY timestamp ROWS 20 PRECEDING) as sma,
                    -- stddev_samp not supported as window? Use manual: sqrt(avg(x^2) - avg(x)^2)
                    avg(close * close) OVER (PARTITION BY symbol ORDER BY timestamp ROWS 20 PRECEDING) as avg_sq,
                    avg(tr) OVER (PARTITION BY symbol ORDER BY timestamp ROWS 20 PRECEDING) as atr
                FROM with_tr
            )
            SELECT * FROM stats LIMIT 5
`;

async function run() {
    console.log('Running SQL...');
    try {
        const res = await queryQuestDB(sql);
        console.log('Result count:', res.count);
        if (res.error) console.error('QuestDB Error:', res.error);
    } catch (e) {
        console.error('Exception:', e);
    }
}

run();

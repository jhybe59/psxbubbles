/**
 * Analyze Breakouts - 50 Tick Intervals
 * Scans local QuestDB for price jumps > 1% within any 50-tick window.
 */

const QUESTDB_URL = 'http://localhost:9000/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        return await res.json();
    } catch (e) {
        console.error("Fetch error:", e.message);
        return { error: e.message };
    }
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  50-TICK BREAKOUT ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        // 1. Get list of all symbols
        console.log("Fetching symbols...");
        const symbolsRes = await query("SELECT DISTINCT symbol FROM trades");

        if (!symbolsRes.dataset) {
            console.error("Could not fetch symbols or no data in 'trades' table.");
            console.log("Response:", symbolsRes);
            return;
        }

        const symbols = symbolsRes.dataset.map(r => r[0]);
        console.log(`Found ${symbols.length} symbols.`);

        const BREAKOUT_THRESHOLD_PCT = 1.0; // 1% move
        const RVOL_THRESHOLD = 1.5;         // 1.5x volume (rough proxy)

        console.log(`Scanning for >${BREAKOUT_THRESHOLD_PCT}% moves in 50-tick buckets...`);
        console.log('─'.repeat(70));
        console.log('Symbol\tTime\t\tOpen\tClose\tChange\tVolume\tRVOL');

        let totalBreakouts = 0;

        for (const symbol of symbols) {
            // Check each symbol
            // Logic:
            // 1. Create buckets of 50 ticks using tick_seq
            // 2. Calc price change in bucket
            // 3. Filter > 1%

            // Note: tick_seq might reset per day or be global. 
            // We assume tick_seq is reliable or we use row_number().
            // If tick_seq is missing, we might default to just time based if needed, but assuming tick_seq exists per valid schema.

            const sql = `
                WITH buckets AS (
                    SELECT 
                        symbol,
                        timestamp,
                        price,
                        volume,
                        floor(tick_seq / 50) as bucket_id
                    FROM trades
                    WHERE symbol = '${symbol}'
                ),
                bucket_stats AS (
                    SELECT
                        bucket_id,
                        first(timestamp) as time_start,
                        first(price) as open,
                        last(price) as close,
                        max(price) as high,
                        min(price) as low,
                        sum(volume) as vol,
                        count() as tick_count
                    FROM buckets
                    GROUP BY bucket_id
                ),
                avg_vol AS (
                    SELECT avg(vol) as avg_bucket_vol FROM bucket_stats
                )
                SELECT
                    bs.time_start,
                    bs.open,
                    bs.close,
                    bs.vol,
                    av.avg_bucket_vol
                FROM bucket_stats bs, avg_vol av
                WHERE abs((bs.close - bs.open) / bs.open) * 100 > ${BREAKOUT_THRESHOLD_PCT}
                ORDER BY bs.time_start
            `;

            const res = await query(sql);

            if (res.dataset && res.dataset.length > 0) {
                for (const row of res.dataset) {
                    const [ts, open, close, vol, avgVol] = row;
                    const change = ((close - open) / open) * 100;
                    const rvol = avgVol > 0 ? (vol / avgVol) : 0;

                    if (change > 0) {
                        const timeStr = new Date(ts).toLocaleString();
                        console.log(`${symbol}\t${timeStr}\t${open.toFixed(2)}\t${close.toFixed(2)}\t+${change.toFixed(2)}%\t${vol}\t${rvol.toFixed(1)}x`);

                        // Append to CSV
                        const csvLine = `${symbol},${ts},${open},${close},${change.toFixed(4)},${vol},${rvol.toFixed(4)}\n`;
                        fs.appendFileSync('breakouts_50t.csv', csvLine);

                        totalBreakouts++;
                    }
                }
            }
        }

        console.log('─'.repeat(70));
        console.log(`Total Breakouts Found: ${totalBreakouts}`);
        console.log(`Results saved to breakouts_50t.csv`);

    } catch (err) {
        console.error('Error:', err.message);
        console.error(err.stack);
    }
}

// Ensure fs is imported
import fs from 'fs';
// Reset CSV file
fs.writeFileSync('breakouts_50t.csv', 'Symbol,Timestamp,Open,Close,ChangePct,Volume,RVOL\n');

main();

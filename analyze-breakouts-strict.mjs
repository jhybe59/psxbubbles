
import fs from 'fs';

const QUESTDB_URL = 'http://localhost:9000/exec';

// --- CONFIGURATION ---
const TICK_BUCKET_SIZE = 50;
const MIN_CHANGE_PCT = 3.0; // User requested > 3%
const MIN_RVOL = 2.0;       // User requested "with volume" (assumed > 2x average)
// ---------------------

async function queryQuestDB(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}&fmt=json`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`QuestDB query failed: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Query Error:', error.message);
        return null;
    }
}

async function main() {
    console.log("Analyzing 50-tick breakouts...");
    console.log(`Criteria: Price Change >= ${MIN_CHANGE_PCT}% AND RVOL >= ${MIN_RVOL}x`);
    console.log('─'.repeat(70));

    // Reset CSV file
    fs.writeFileSync('breakouts_strict.csv', 'Symbol,Time_PKT,Open,Close,ChangePct,Duration,Volume,RVOL\n');

    try {
        // 1. Get all symbols
        const symbolsRes = await queryQuestDB("SELECT distinct symbol FROM trades");
        if (!symbolsRes || !symbolsRes.dataset) return;

        const symbols = symbolsRes.dataset.map(r => r[0]);
        let allBreakouts = [];

        for (const symbol of symbols) {
            // 2. Sample 50 ticks
            // We use floor(row_number / 50) to group
            const sql = `
                WITH raw_trades AS (
                    SELECT 
                        timestamp,
                        price,
                        volume,
                        row_number() OVER (ORDER BY timestamp) as rn
                    FROM trades
                    WHERE symbol = '${symbol}'
                ),
                buckets AS (
                    SELECT
                        floor((rn - 1) / ${TICK_BUCKET_SIZE}) as bucket_id,
                        first(timestamp) as start_ts,
                        last(timestamp) as end_ts,
                        first(price) as open,
                        max(price) as high,
                        last(price) as close,
                        sum(volume) as vol
                    FROM raw_trades
                    GROUP BY floor((rn - 1) / ${TICK_BUCKET_SIZE})
                ),
                stats AS (
                    SELECT 
                        *,
                        avg(vol) OVER (ROWS BETWEEN 20 PRECEDING AND 1 PRECEDING) as avg_vol
                    FROM buckets
                )
                SELECT 
                    start_ts, end_ts, open, close, vol, avg_vol 
                FROM stats 
                WHERE close > open
            `;

            const res = await queryQuestDB(sql);

            if (res && res.dataset && res.dataset.length > 0) {
                for (const row of res.dataset) {
                    const [startTs, endTs, open, close, vol, avgVol] = row;
                    const change = ((close - open) / open) * 100;
                    const rvol = avgVol > 0 ? (vol / avgVol) : 0;

                    if (change >= MIN_CHANGE_PCT && rvol >= MIN_RVOL) {
                        // Calculate Duration
                        const d1 = new Date(startTs);
                        const d2 = new Date(endTs);
                        const durationMs = d2 - d1;
                        const durationSec = durationMs / 1000;

                        // Format Duration String (e.g., "2m 15s")
                        const mins = Math.floor(durationSec / 60);
                        const secs = Math.floor(durationSec % 60);
                        const durationStr = `${mins}m ${secs}s`;

                        // Convert to PKT (UTC+5)
                        const pktTime = d1.toLocaleString('en-US', { timeZone: 'Asia/Karachi' });

                        allBreakouts.push({
                            symbol,
                            ts: startTs,
                            pktTime,
                            open,
                            close,
                            change,
                            durationStr,
                            vol,
                            rvol
                        });
                    }
                }
            }
        }

        // 3. Sort by Timestamp (Oldest first)
        allBreakouts.sort((a, b) => new Date(a.ts) - new Date(b.ts));

        // 4. Write sorted results
        console.log(`Writing ${allBreakouts.length} sorted breakouts...`);

        for (const b of allBreakouts) {
            console.log(`${b.symbol}\t${b.pktTime}\t+${b.change.toFixed(2)}%\t${b.durationStr}\t${b.rvol.toFixed(1)}x`);

            const csvLine = `${b.symbol},"${b.pktTime}",${b.open},${b.close},${b.change.toFixed(4)},${b.durationStr},${b.vol},${b.rvol.toFixed(4)}\n`;
            fs.appendFileSync('breakouts_strict.csv', csvLine);
        }

        console.log('─'.repeat(70));
        console.log(`Total Breakouts Found: ${allBreakouts.length}`);
        console.log(`Results saved to breakouts_strict.csv (Sorted by Time)`);

    } catch (err) {
        console.error('Error:', err.message);
        console.error(err.stack);
    }
}

main();

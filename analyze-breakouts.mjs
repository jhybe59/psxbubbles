/**
 * Deep Analysis: Find Real Breakouts from Railway QuestDB
 */

const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DEEP ANALYSIS: Today\'s Breakout Patterns');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        // Get today's date in format QuestDB understands
        const today = new Date().toISOString().split('T')[0];
        console.log('Date filter:', today);

        // Step 1: Find top gainers
        console.log('\n1. TOP GAINERS TODAY\n');

        const gainersSQL = `
            SELECT 
                symbol,
                first(price) as open_price,
                last(price) as close_price,
                max(price) as day_high,
                min(price) as day_low,
                sum(volume) as total_volume
            FROM trades
            WHERE timestamp >= '${today}'
            GROUP BY symbol
            ORDER BY (last(price) - first(price)) / first(price) DESC
            LIMIT 15
        `;

        const gainers = await query(gainersSQL);

        if (gainers.error) {
            console.log('Query error:', gainers.error);
            return;
        }

        if (!gainers.dataset || gainers.dataset.length === 0) {
            console.log('No data for today');
            return;
        }

        console.log('Columns:', gainers.columns?.map(c => c.name).join(', '));
        console.log('');
        console.log('Symbol\t\tOpen\t\tClose\t\tHigh\t\tVolume');
        console.log('─'.repeat(70));

        const topSymbols = [];
        gainers.dataset.forEach(row => {
            const [symbol, open, close, high, low, vol] = row;
            const gainPct = ((close - open) / open * 100);
            if (gainPct > 0.5) { // Positive gainers
                topSymbols.push({ symbol, open, close, gainPct });
                console.log(`${symbol}\t\t${open?.toFixed(2)}\t\t${close?.toFixed(2)}\t\t${high?.toFixed(2)}\t\t${vol?.toLocaleString()}\t+${gainPct.toFixed(2)}%`);
            }
        });

        // Step 2: Detailed analysis of top 3
        console.log('\n\n2. DETAILED BREAKOUT ANALYSIS\n');

        for (const { symbol, gainPct } of topSymbols.slice(0, 5)) {
            console.log(`\n${'━'.repeat(60)}`);
            console.log(`  ${symbol} (+${gainPct.toFixed(2)}%)`);
            console.log('━'.repeat(60));

            // Get 5-minute bars
            const barsSQL = `
                SELECT 
                    timestamp,
                    first(price) as open,
                    max(price) as high,
                    min(price) as low,
                    last(price) as close,
                    sum(volume) as volume
                FROM trades
                WHERE symbol = '${symbol}' AND timestamp >= '${today}'
                SAMPLE BY 5m
                ORDER BY timestamp
            `;

            const bars = await query(barsSQL);

            if (!bars.dataset || bars.dataset.length === 0) {
                console.log('No bar data');
                continue;
            }

            // Calculate ORB levels (first 30 min = 6 bars)
            const orbBars = bars.dataset.slice(0, 6);
            const orb5mHigh = bars.dataset[0]?.[2] || 0;
            const orb15mHigh = Math.max(...bars.dataset.slice(0, 3).map(b => b[2] || 0));
            const orb30mHigh = Math.max(...orbBars.map(b => b[2] || 0));

            console.log('\nORB Levels:');
            console.log(`  5m High: ${orb5mHigh?.toFixed(2)}`);
            console.log(`  15m High: ${orb15mHigh?.toFixed(2)}`);
            console.log(`  30m High: ${orb30mHigh?.toFixed(2)}`);

            // Find breakout moments
            const findBreakout = (orbHigh, startIdx) => {
                for (let i = startIdx; i < bars.dataset.length; i++) {
                    const high = bars.dataset[i][2];
                    if (high > orbHigh) {
                        return { bar: bars.dataset[i], idx: i };
                    }
                }
                return null;
            };

            console.log('\nBreakout Moments:');
            const break5m = findBreakout(orb5mHigh, 1);
            const break15m = findBreakout(orb15mHigh, 3);
            const break30m = findBreakout(orb30mHigh, 6);

            if (break5m) {
                const time = new Date(break5m.bar[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                console.log(`  ORB 5m broken at: ${time} (bar #${break5m.idx + 1})`);
            }
            if (break15m) {
                const time = new Date(break15m.bar[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                console.log(`  ORB 15m broken at: ${time} (bar #${break15m.idx + 1})`);
            }
            if (break30m) {
                const time = new Date(break30m.bar[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                console.log(`  ORB 30m broken at: ${time} (bar #${break30m.idx + 1})`);
            }

            // Volume analysis
            const avgVol = orbBars.reduce((s, b) => s + (b[5] || 0), 0) / orbBars.length;
            console.log('\nVolume Analysis:');
            console.log(`  Avg ORB volume (30m): ${avgVol?.toLocaleString()}`);

            // Find max volume bar
            let maxVolBar = bars.dataset[0];
            bars.dataset.forEach(b => {
                if ((b[5] || 0) > (maxVolBar[5] || 0)) maxVolBar = b;
            });
            const maxTime = new Date(maxVolBar[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            const maxRvol = avgVol > 0 ? (maxVolBar[5] / avgVol).toFixed(2) : 'N/A';
            console.log(`  Max volume at: ${maxTime} - ${maxVolBar[5]?.toLocaleString()} (${maxRvol}x avg)`);

            // Show first 12 bars
            console.log('\nPrice Progression (5m bars):');
            bars.dataset.slice(0, 12).forEach((bar, i) => {
                const time = new Date(bar[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                const label = i < 1 ? '[ORB5m]' : i < 3 ? '[ORB15m]' : i < 6 ? '[ORB30m]' : '';
                const rvol = avgVol > 0 ? ((bar[5] || 0) / avgVol).toFixed(1) + 'x' : '-';
                console.log(`  ${time}: O=${bar[1]?.toFixed(2)} H=${bar[2]?.toFixed(2)} L=${bar[3]?.toFixed(2)} C=${bar[4]?.toFixed(2)} Vol=${rvol} ${label}`);
            });
        }

        console.log('\n\n3. KEY OBSERVATIONS\n');
        console.log('Look at the above data and note:');
        console.log('  - At what time did most breakouts happen?');
        console.log('  - What RVOL was present at breakout moment?');
        console.log('  - Did breakout candles have high volume?');

    } catch (err) {
        console.error('Error:', err.message);
        console.error(err.stack);
    }
}

main();

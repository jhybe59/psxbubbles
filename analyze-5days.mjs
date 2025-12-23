/**
 * 5-DAY COMPREHENSIVE BREAKOUT ANALYSIS
 * Analyze breakouts from last 5 days to find reliable patterns
 */

const QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

async function query(sql) {
    const url = `${QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
    const res = await fetch(url);
    return res.json();
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  5-DAY BREAKOUT ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Check data range
    console.log('1. CHECKING DATA RANGE\n');

    const rangeSQL = `SELECT min(timestamp), max(timestamp), count() FROM trades`;
    const range = await query(rangeSQL);

    if (range.error) {
        console.log('Error:', range.error);
        return;
    }

    console.log('Data range:', range.dataset);

    // Step 2: Get unique trading days
    console.log('\n2. TRADING DAYS AVAILABLE\n');

    const daysSQL = `
        SELECT DISTINCT date_trunc('day', timestamp) as day, count() as trades
        FROM trades
        GROUP BY day
        ORDER BY day DESC
        LIMIT 10
    `;

    const days = await query(daysSQL);
    console.log('Days with data:');
    days.dataset?.forEach(d => {
        console.log('  ', d[0], '- trades:', d[1]?.toLocaleString());
    });

    // Step 3: Find top gainers from each day
    console.log('\n\n3. TOP GAINERS BY DAY\n');

    const tradingDays = days.dataset?.slice(0, 5).map(d => d[0].split('T')[0]) || [];

    const allBreakouts = [];

    for (const day of tradingDays) {
        console.log(`\n━━━ ${day} ━━━`);

        const gainersSQL = `
            SELECT 
                symbol,
                first(price) as open_price,
                last(price) as close_price,
                max(price) as high,
                min(price) as low,
                sum(volume) as volume
            FROM trades
            WHERE timestamp >= '${day}' AND timestamp < '${day}T23:59:59'
            GROUP BY symbol
            ORDER BY (last(price) - first(price)) / first(price) DESC
            LIMIT 10
        `;

        const gainers = await query(gainersSQL);

        if (gainers.dataset) {
            gainers.dataset.forEach(r => {
                const [symbol, open, close, high, low, vol] = r;
                const gain = ((close - open) / open * 100);
                if (gain > 1) { // Only significant gainers (>1%)
                    console.log(`  ${symbol}: +${gain.toFixed(2)}%`);
                    allBreakouts.push({
                        day,
                        symbol,
                        gain,
                        open,
                        close,
                        high,
                        low,
                        volume: vol
                    });
                }
            });
        }
    }

    // Step 4: Summary statistics
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('  5-DAY SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`Total significant breakouts (>1%): ${allBreakouts.length}`);

    // Breakouts per day
    const byDay = {};
    allBreakouts.forEach(b => {
        byDay[b.day] = (byDay[b.day] || 0) + 1;
    });
    console.log('\nBreakouts per day:');
    Object.keys(byDay).forEach(d => console.log(`  ${d}: ${byDay[d]}`));

    // Top symbols that appeared multiple times
    const bySymbol = {};
    allBreakouts.forEach(b => {
        bySymbol[b.symbol] = (bySymbol[b.symbol] || 0) + 1;
    });

    const repeatBreakouts = Object.entries(bySymbol)
        .filter(([_, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);

    console.log('\nSymbols with multiple breakouts:');
    repeatBreakouts.forEach(([sym, count]) => {
        console.log(`  ${sym}: ${count} times`);
    });

    // Average gain
    const avgGain = allBreakouts.reduce((s, b) => s + b.gain, 0) / allBreakouts.length;
    console.log(`\nAverage breakout gain: +${avgGain.toFixed(2)}%`);

    // Top breakouts overall
    console.log('\nTop 10 breakouts (5 days):');
    allBreakouts
        .sort((a, b) => b.gain - a.gain)
        .slice(0, 10)
        .forEach((b, i) => {
            console.log(`  ${i + 1}. ${b.symbol} (${b.day}): +${b.gain.toFixed(2)}%`);
        });
}

main().catch(console.error);

import { execFile } from 'node:child_process';
import fs from 'node:fs';

const RAILWAY_QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

function curlQuery(sql) {
    return new Promise((resolve, reject) => {
        const url = `${RAILWAY_QUESTDB_URL}?query=${encodeURIComponent(sql)}`;
        // Use -k (insecure/no-cert-check), -s (silent)
        execFile('curl.exe', ['-k', '-s', url], { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            try {
                const json = JSON.parse(stdout);
                resolve(json);
            } catch (e) {
                console.error("JSON Parse Error on output:", stdout.substring(0, 100));
                reject(e);
            }
        });
    });
}

// 1. Get List of Symbols
async function getSymbols() {
    console.log("📥 Fetching symbol list via curl.exe...");
    const sql = `SELECT DISTINCT symbol FROM trades WHERE timestamp >= '2026-01-08T04:30:00.000000Z'`;
    const res = await curlQuery(sql);
    return res.dataset ? res.dataset.map(r => r[0]) : [];
}

// 2. Fetch M1 Bars for ONE Symbol
async function getBarsForSymbol(symbol) {
    // console.log(`   Fetching ${symbol}...`);
    const sql = `
        SELECT 
            symbol, timestamp, 
            first(price) as open, max(price) as high, min(price) as low, last(price) as close, sum(volume) as volume
        FROM trades 
        WHERE symbol = '${symbol}' 
          AND timestamp >= '2026-01-08T04:30:00.000000Z' 
          AND timestamp <= '2026-01-08T10:30:00.000000Z'
        SAMPLE BY 1m ALIGN TO CALENDAR
    `;
    const res = await curlQuery(sql);
    return res.dataset || [];
}

async function run() {
    try {
        const symbols = await getSymbols();
        console.log(`✅ Found ${symbols.length} symbols. Fetching bars sequentially...`);

        const allData = {};

        // Sequential fetch
        for (let i = 0; i < symbols.length; i++) {
            const sym = symbols[i];
            if (i % 5 === 0) process.stdout.write(`\r[${i}/${symbols.length}] Processing...`);

            try {
                const rows = await getBarsForSymbol(sym);
                allData[sym] = rows.map(r => ({
                    time: new Date(r[1]),
                    open: r[2], high: r[3], low: r[4], close: r[5], volume: r[6]
                })).sort((a, b) => a.time - b.time);
            } catch (e) {
                console.error(`\nFailed to fetch ${sym}: ${e.message}`);
            }
        }
        console.log("\n✅ All data fetched. Analyzing...");

        // --- ANALYSIS ---
        const THRESHOLDS = { tightness: 0.015, volPulse: 3.0, proximity: 0.030 };
        const report = [];

        Object.keys(allData).forEach(sym => {
            const bars = allData[sym];
            let sessionHigh = 0;
            let signalFound = false;

            for (let i = 0; i < bars.length; i++) {
                const bar = bars[i];
                if (bar.high > sessionHigh) sessionHigh = bar.high;
                if (i < 15) continue;

                const window = bars.slice(i - 15, i + 1);
                const w_high = Math.max(...window.map(b => b.high));
                const w_low = Math.min(...window.map(b => b.low));
                const w_vol = window.reduce((s, b) => s + b.volume, 0) / window.length;

                const tightness = bar.close > 0 ? (w_high - w_low) / bar.close : 99;
                const volPulse = w_vol > 0 ? (bar.volume / w_vol) : 0;
                const proximity = sessionHigh > 0 ? (sessionHigh - bar.close) / sessionHigh : 99;

                if (!signalFound &&
                    tightness < THRESHOLDS.tightness &&
                    volPulse > THRESHOLDS.volPulse &&
                    proximity < THRESHOLDS.proximity
                ) {
                    signalFound = true;
                    const entry = bar.close;

                    // Future max
                    let maxAfter = entry;
                    for (let j = i + 1; j < bars.length; j++) {
                        if (bars[j].high > maxAfter) maxAfter = bars[j].high;
                    }

                    const maxGain = ((maxAfter - entry) / entry) * 100;

                    let verdict = "⚖️ CHOPPY";
                    let icon = "⚪";
                    if (maxGain >= 2.0) { verdict = "🚀 SUPER"; icon = "🟢"; }
                    else if (maxGain >= 1.0) { verdict = "✅ BREAKOUT"; icon = "🟢"; }
                    else if (maxGain < 0.5) { verdict = "💤 DUD"; icon = "⚪"; }

                    report.push({
                        time: bar.time.toISOString().split('T')[1].replace('Z', ''),
                        symbol: sym,
                        price: entry,
                        metrics: `T:${(tightness * 100).toFixed(1)}% V:${volPulse.toFixed(1)}x`,
                        maxGain: maxGain.toFixed(2),
                        verdict, icon
                    });
                    break;
                }
            }
        });

        report.sort((a, b) => a.time.localeCompare(b.time));

        let md = `# 📊 Detailed Pre-Breakout Backtest (8 Jan 2026)\n\n| Time (UTC) | Symbol | Price | Metrics | Max Gain | Verdict |\n|---|---|---|---|---|---|\n`;
        report.forEach(r => {
            md += `| ${r.time} | **${r.symbol}** | ${r.price} | ${r.metrics} | **${r.maxGain}%** | ${r.icon} ${r.verdict} |\n`;
        });

        fs.writeFileSync('backtest_final_report.md', md);
        console.log("✅ Report saved: backtest_final_report.md");
        // console.log(md);

    } catch (err) {
        console.error("Fatal Error:", err);
    }
}

run();

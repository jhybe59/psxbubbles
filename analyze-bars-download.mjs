import https from 'node:https';
import fs from 'node:fs';

const RAILWAY_QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

// Fetch Pre-Aggregated Bars (Much smaller than raw trades)
// This reduces network load by ~10-20x
const sql = `
    SELECT 
        symbol,
        timestamp,
        first(price) as open,
        max(price) as high,
        min(price) as low,
        last(price) as close,
        sum(volume) as volume
    FROM trades
    WHERE timestamp BETWEEN '2026-01-08T04:30:00.000000Z' AND '2026-01-08T10:30:00.000000Z'
    SAMPLE BY 1m ALIGN TO CALENDAR
`;

console.log("📥 Downloading 1-minute bars (lightweight)...");

const url = `${RAILWAY_QUESTDB_URL}?query=${encodeURIComponent(sql)}`;

https.get(url, { rejectUnauthorized: false, timeout: 60000 }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (!json.dataset) throw new Error("No dataset");
            console.log(`✅ Loaded ${json.dataset.length} minute bars.`);
            runAnalysis(json.dataset);
        } catch (e) {
            console.error("❌ Download/Parse failed:", e.message);
            console.log("Partial data:", data.substring(0, 200));
        }
    });
}).on('error', e => console.error("Network error:", e.message));

// --- LOCAL ANALYSIS ---
const THRESHOLDS = { tightness: 0.015, volPulse: 3.0, proximity: 0.030 };

function runAnalysis(rows) {
    const history = {};
    rows.forEach(row => {
        const [sym, ts, o, h, l, c, vol] = row;
        if (!history[sym]) history[sym] = [];
        history[sym].push({ time: new Date(ts), open: o, high: h, low: l, close: c, volume: vol });
    });

    const report = [];

    Object.keys(history).forEach(sym => {
        const bars = history[sym].sort((a, b) => a.time - b.time);

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

            // Signal check
            if (!signalFound &&
                tightness < THRESHOLDS.tightness &&
                volPulse > THRESHOLDS.volPulse &&
                proximity < THRESHOLDS.proximity
            ) {
                signalFound = true;
                const entry = bar.close;

                // Future max
                let maxAfter = entry;
                let final = entry;
                for (let j = i + 1; j < bars.length; j++) {
                    if (bars[j].high > maxAfter) maxAfter = bars[j].high;
                    final = bars[j].close;
                }

                const maxGain = ((maxAfter - entry) / entry) * 100;

                let verdict = "⚖️ CHOPPY";
                let icon = "⚪";
                if (maxGain >= 1.0) { verdict = "🚀 BREAKOUT"; icon = "🟢"; }
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

    let md = `# 📊 Detailed Pre-Breakout Backtest (8 Jan 2026)\n\n| Time | Symbol | Price | Metrics | Max Gain | Verdict |\n|---|---|---|---|---|---|\n`;
    report.forEach(r => {
        md += `| ${r.time} | **${r.symbol}** | ${r.price} | ${r.metrics} | **${r.maxGain}%** | ${r.icon} ${r.verdict} |\n`;
    });

    fs.writeFileSync('backtest_final_report.md', md);
    console.log("✅ Report saved: backtest_final_report.md");
    console.log(md);
}

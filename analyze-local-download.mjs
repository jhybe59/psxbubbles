import https from 'node:https';
import fs from 'node:fs';

const RAILWAY_QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';
const FILE_PATH = 'day_data.json';

const sql = `SELECT symbol,timestamp,volume,first(price)as open,max(price)as high,min(price)as low,last(price)as close FROM trades WHERE timestamp >= '2026-01-08T04:30:00.000000Z' AND timestamp <= '2026-01-08T10:30:00.000000Z' SAMPLE BY 1m ALIGN TO CALENDAR`;

console.log("📥 Downloading data to file...");

const url = `${RAILWAY_QUESTDB_URL}?query=${encodeURIComponent(sql)}`;

https.get(url, { rejectUnauthorized: false }, (res) => {
    if (res.statusCode !== 200) {
        console.error(`HTTP Check failed: ${res.statusCode}`);
        res.resume();
        return;
    }

    const stream = fs.createWriteStream(FILE_PATH);
    res.pipe(stream);

    stream.on('finish', () => {
        console.log("✅ Download complete. Processing local file...");
        runLocalAnalysis();
    });
}).on('error', (err) => console.error("Download Error:", err));


// --- ANALYSIS LOGIC ---
const THRESHOLDS = { tightness: 0.015, volPulse: 3.0, proximity: 0.030 };

async function runLocalAnalysis() {
    const rawData = fs.readFileSync(FILE_PATH, 'utf8');
    let json;
    try {
        json = JSON.parse(rawData);
    } catch (e) {
        console.error("JSON Parse Error. Data might be incomplete.", e.message);
        return;
    }

    if (!json.dataset) {
        console.error("No dataset in JSON:", json);
        return;
    }

    console.log(`Loaded ${json.dataset.length} rows.`);

    // Organize by symbol
    const history = {};
    json.dataset.forEach(row => {
        // QuestDB cols: symbol, timestamp, volume, open, high, low, close
        // Index:        0       1          2       3     4     5    6
        const [sym, ts, vol, o, h, l, c] = row;
        if (!history[sym]) history[sym] = [];
        history[sym].push({
            time: new Date(ts),
            open: o, high: h, low: l, close: c, volume: vol
        });
    });

    const reportEvents = [];

    // Sort logic same as before...
    for (const sym in history) {
        const bars = history[sym].sort((a, b) => a.time - b.time);

        // Ensure enough bars
        if (bars.length < 15) continue;

        let sessionHigh = 0;
        let signalTriggered = false;

        for (let i = 0; i < bars.length; i++) {
            const bar = bars[i];
            if (bar.high > sessionHigh) sessionHigh = bar.high;
            if (i < 15) continue;

            const windowBars = bars.slice(i - 15, i + 1);
            const w_high = Math.max(...windowBars.map(b => b.high));
            const w_low = Math.min(...windowBars.map(b => b.low));
            const w_vol = windowBars.reduce((s, b) => s + b.volume, 0) / windowBars.length;

            const tightness = bar.close > 0 ? (w_high - w_low) / bar.close : 99;
            const volPulse = w_vol > 0 ? (bar.volume / w_vol) : 0;
            const proximity = sessionHigh > 0 ? (sessionHigh - bar.close) / sessionHigh : 99;

            if (!signalTriggered &&
                tightness < THRESHOLDS.tightness &&
                volPulse > THRESHOLDS.volPulse &&
                proximity < THRESHOLDS.proximity
            ) {
                signalTriggered = true;

                // Analyzer Outcome
                const entry = bar.close;
                let maxAfter = entry;
                let final = entry;

                for (let j = i + 1; j < bars.length; j++) {
                    if (bars[j].high > maxAfter) maxAfter = bars[j].high;
                    final = bars[j].close;
                }

                const maxGain = ((maxAfter - entry) / entry) * 100;
                const finalGain = ((final - entry) / entry) * 100;

                let grade = "⚖️ CHOPPY";
                if (maxGain >= 1.0 && finalGain >= 0.5) grade = "✅ TRUE BREAKOUT";
                else if (maxGain >= 1.0) grade = "⚠️ FAKEOUT";
                else if (maxGain < 0.5) grade = "💤 DUD";

                reportEvents.push({
                    symbol: sym,
                    time: bar.time.toISOString().split('T')[1].replace('Z', ''),
                    price: entry,
                    metrics: `T:${(tightness * 100).toFixed(1)}% V:${volPulse.toFixed(1)}x P:${(proximity * 100).toFixed(1)}%`,
                    maxGain: maxGain.toFixed(2) + '%',
                    grade
                });
                break;
            }
        }
    }

    reportEvents.sort((a, b) => a.time.localeCompare(b.time));

    let md = `# 🕵️‍♂️ detailed Pre-Breakout Backtest (8 Jan 2026)\n\n`;
    md += `| Time | Symbol | Price | Metrics | Max Gain | Verdict |\n|---|---|---|---|---|---|\n`;
    reportEvents.forEach(e => {
        md += `| ${e.time} | **${e.symbol}** | ${e.price} | ${e.metrics} | **${e.maxGain}** | ${e.grade} |\n`;
    });

    fs.writeFileSync('backtest_final_report.md', md);
    console.log("✅ Report saved: backtest_final_report.md");
    console.log(md);
}

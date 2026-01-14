import https from 'node:https';
import fs from 'node:fs';

const RAILWAY_QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

// Generate 15-minute chunks for 8th Jan 04:30 to 10:30 UTC
const CHUNKS = [];
let currTime = new Date('2026-01-08T04:30:00Z').getTime();
const endTime = new Date('2026-01-08T10:30:00Z').getTime();

while (currTime < endTime) {
    const nextTime = Math.min(currTime + 15 * 60 * 1000, endTime); // 15 mins
    CHUNKS.push({
        start: new Date(currTime).toISOString(),
        end: new Date(nextTime).toISOString()
    });
    currTime = nextTime;
}

const httpsAgent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });

async function downloadChunk(index) {
    if (index >= CHUNKS.length) {
        console.log("✅ All chunks done. Merging...");
        mergeAndAnalyze();
        return;
    }

    const { start, end } = CHUNKS[index];
    const filename = `data_chunk_${index}.json`;

    if (fs.existsSync(filename)) {
        console.log(`⏩ Skipping ${filename} (already exists)`);
        downloadChunk(index + 1);
        return;
    }

    console.log(`⬇️ [${index + 1}/${CHUNKS.length}] Downloading ${start.split('T')[1]}...`);

    const sql = `SELECT symbol,timestamp,volume,first(price)as open,max(price)as high,min(price)as low,last(price)as close FROM trades WHERE timestamp >= '${start}' AND timestamp < '${end}' SAMPLE BY 1m ALIGN TO CALENDAR`;
    const url = `${RAILWAY_QUESTDB_URL}?query=${encodeURIComponent(sql)}`;

    const req = https.get(url, { agent: httpsAgent, timeout: 30000 }, (res) => {
        if (res.statusCode !== 200) {
            console.error(`   ❌ HTTP ${res.statusCode}`);
            setTimeout(() => downloadChunk(index), 2000); // retry
            return;
        }

        const stream = fs.createWriteStream(filename);
        res.pipe(stream);

        stream.on('finish', () => {
            const stat = fs.statSync(filename);
            if (stat.size < 100) { // Valid JSON for empty result usually small, but "empty query" error is ~50 bytes
                const content = fs.readFileSync(filename, 'utf8');
                if (content.includes('error')) {
                    console.error("   ❌ API Error:", content);
                }
            }
            downloadChunk(index + 1);
        });
    });

    req.on('error', (err) => {
        console.error(`   ❌ Network error: ${err.message}`);
        setTimeout(() => downloadChunk(index), 2000); // retry
    });
}

function mergeAndAnalyze() {
    console.log("🔄 Merging data...");
    let allRows = [];

    for (let i = 0; i < CHUNKS.length; i++) {
        try {
            const filename = `data_chunk_${i}.json`;
            if (!fs.existsSync(filename)) continue;
            const content = fs.readFileSync(filename, 'utf8');
            const json = JSON.parse(content);
            if (json.dataset) {
                allRows = allRows.concat(json.dataset);
            }
        } catch (e) {
            console.error(`Error parsing chunk ${i}:`, e.message);
        }
    }

    console.log(`✅ Total rows: ${allRows.length}. Running analysis...`);
    runAnalysis(allRows);
}

// Start
downloadChunk(0);

// --- ANALYSIS LOGIC ---
const THRESHOLDS = { tightness: 0.015, volPulse: 3.0, proximity: 0.030 };

function runAnalysis(rows) {
    // Organize by symbol
    const history = {};
    rows.forEach(row => {
        const [sym, ts, vol, o, h, l, c] = row;
        if (!history[sym]) history[sym] = [];
        history[sym].push({
            time: new Date(ts),
            open: o, high: h, low: l, close: c, volume: vol
        });
    });

    const reportEvents = [];

    for (const sym in history) {
        const bars = history[sym].sort((a, b) => a.time - b.time);

        // Remove 'break' to capture ALL signals per symbol? User wants detailed report.
        let signalTriggered = false;

        for (let i = 0; i < bars.length; i++) {
            const bar = bars[i];

            // Need session high up to this point
            // Optimization: Calculate session high incrementally
            const pastBars = bars.slice(0, i + 1);
            const sessionHigh = Math.max(...pastBars.map(b => b.high));

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

                const entry = bar.close;
                let maxAfter = entry;
                let final = entry;

                // Track future performance
                for (let j = i + 1; j < bars.length; j++) {
                    if (bars[j].high > maxAfter) maxAfter = bars[j].high;
                    final = bars[j].close;
                }

                const maxGain = ((maxAfter - entry) / entry) * 100;
                const finalGain = ((final - entry) / entry) * 100;

                let grade = "⚖️ CHOPPY";
                let icon = "⚪";
                if (maxGain >= 2.0 && finalGain >= 1.0) { grade = "🚀 SUPER BREAKOUT"; icon = "🟢"; }
                else if (maxGain >= 1.0 && finalGain >= 0.5) { grade = "✅ TRUE BREAKOUT"; icon = "🟢"; }
                else if (maxGain >= 1.0 && finalGain < 0) { grade = "⚠️ FAKEOUT"; icon = "🔴"; }
                else if (maxGain < 0.5) { grade = "💤 DUD"; icon = "⚪"; }

                reportEvents.push({
                    symbol: sym,
                    time: bar.time.toISOString().split('T')[1].replace('Z', ''),
                    price: entry,
                    metrics: `T:${(tightness * 100).toFixed(1)}% V:${volPulse.toFixed(1)}x P:${(proximity * 100).toFixed(1)}%`,
                    maxGain: maxGain.toFixed(2) + '%',
                    grade,
                    icon
                });
                break; // One signal per symbol
            }
        }
    }

    reportEvents.sort((a, b) => a.time.localeCompare(b.time));

    let md = `# 📊 Detailed Pre-Breakout Backtest Report (8 Jan 2026)\n\n`;
    md += `> **Total Signals Detected:** ${reportEvents.length}\n`;
    md += `> **Analysis Logic:** Tightness < 1.5%, Vol Pulse > 3x, Proximity < 3%\n\n`;

    md += `| Time (UTC) | Symbol | Signal Price | Metrics | Max Gain | Verdict |\n|---|---|---|---|---|---|\n`;
    reportEvents.forEach(e => {
        md += `| ${e.time} | **${e.symbol}** | ${e.price} | ${e.metrics} | **${e.maxGain}** | ${e.icon} ${e.grade} |\n`;
    });

    fs.writeFileSync('backtest_final_report.md', md);
    console.log("✅ Final Report Saved: backtest_final_report.md");
    console.log(md);
}

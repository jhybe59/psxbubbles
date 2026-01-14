// Detailed Backtest Report - Hybrid Approach
// 1. Find Signals using Server-Side SQL
// 2. Query specific future performance for each signal
import https from 'node:https';
import { writeFileSync } from 'node:fs';

const RAILWAY_QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

function queryQuestDB(sql) {
    return new Promise((resolve, reject) => {
        const url = `${RAILWAY_QUESTDB_URL}?query=${encodeURIComponent(sql)}&count=true`;
        // Reliable timeout
        https.get(url, { rejectUnauthorized: false, timeout: 60000 }, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', reject);
    });
}

async function runBacktest() {
    console.log("🔍 [Phase 1] Detecting Signals via Server-Side SQL...");

    const dayStart = '2026-01-08T04:30:00.000Z'; // Market Open
    const dayEnd = '2026-01-08T10:30:00.000Z';   // Market Close

    const sqlObserved = `SELECT count(DISTINCT symbol) FROM trades WHERE timestamp >= '${dayStart}'`;
    const totalSymbols = (await queryQuestDB(sqlObserved)).dataset?.[0]?.[0] ?? 0;

    // Detect Signals (Ranked Pulse = 1 means highest volume spike relative to window)
    const sqlSignals = `
    WITH m1_bars AS (
      SELECT symbol, timestamp,
        first(price) as open,
        max(price) as high,
        min(price) as low,
        last(price) as close,
        sum(volume) as volume
      FROM trades
      WHERE timestamp >= '${dayStart}' AND timestamp < '${dayEnd}'
      SAMPLE BY 1m ALIGN TO CALENDAR
    ),
    session_stats AS (SELECT symbol, max(high) as session_high FROM m1_bars GROUP BY symbol),
    window_stats AS (
      SELECT m.symbol, m.timestamp, m.close, m.high, m.low, m.volume,
        s.session_high,
        max(m.high) OVER (PARTITION BY m.symbol ORDER BY m.timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_high,
        min(m.low)  OVER (PARTITION BY m.symbol ORDER BY m.timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_low,
        avg(m.volume) OVER (PARTITION BY m.symbol ORDER BY m.timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_avg_vol
      FROM m1_bars m
      JOIN session_stats s ON m.symbol = s.symbol
    ),
    derived_metrics AS (
      SELECT *, (volume / NULLIF(w_avg_vol,0)) as calc_pulse FROM window_stats
    ),
    ranked_pulse AS (
      SELECT *, row_number() OVER (PARTITION BY symbol ORDER BY calc_pulse DESC) as rn FROM derived_metrics
    )
    SELECT symbol, timestamp, close, session_high,
      (w_high - w_low) / NULLIF(close,0) as tightness,
      calc_pulse as vol_pulse,
      (session_high - close) / NULLIF(session_high,0) as proximity
    FROM ranked_pulse
    WHERE rn = 1
    `;

    const res = await queryQuestDB(sqlSignals);
    const rows = res.dataset || [];

    const THRESHOLDS = { tightness: 0.015, volPulse: 3.0, proximity: 0.030 };

    // Filter locally
    const signals = [];
    rows.forEach(r => {
        const [sym, ts, close, sessHigh, t, v, p] = r;
        if (t < THRESHOLDS.tightness && v > THRESHOLDS.volPulse && p < THRESHOLDS.proximity) {
            signals.push({
                symbol: sym,
                time: new Date(ts).toISOString(),
                price: close,
                tightness: t,
                volPulse: v,
                proximity: p
            });
        }
    });

    console.log(`✅ Found ${signals.length} signals. Checking future performance...`);

    const reportData = [];

    // [Phase 2] Check Future Max for each signal
    for (let i = 0; i < signals.length; i++) {
        const sig = signals[i];
        if (i % 5 === 0) process.stdout.write(`\r[${i + 1}/${signals.length}] Analyzing ${sig.symbol}...`);

        try {
            // Find max price after signal
            const perfSql = `
                SELECT max(price), last(price) 
                FROM trades 
                WHERE symbol = '${sig.symbol}' 
                  AND timestamp > '${sig.time}' 
                  AND timestamp <= '${dayEnd}'
            `;
            const perfRes = await queryQuestDB(perfSql);
            const [futureMax, finalPrice] = perfRes.dataset?.[0] || [sig.price, sig.price];

            const maxAfter = futureMax || sig.price;
            const endPrice = finalPrice || sig.price;

            const maxGain = ((maxAfter - sig.price) / sig.price) * 100;
            const finalGain = ((endPrice - sig.price) / sig.price) * 100;

            let verdict = "⚖️ CHOPPY";
            let icon = "⚪";
            if (maxGain >= 2.0 && finalGain >= 1.0) { verdict = "🚀 SUPER"; icon = "🟢"; }
            else if (maxGain >= 1.0 && finalGain >= 0.5) { verdict = "✅ BREAKOUT"; icon = "🟢"; }
            else if (maxGain >= 1.0) { verdict = "⚠️ FAKEOUT"; icon = "🔴"; }
            else if (maxGain < 0.5) { verdict = "💤 DUD"; icon = "⚪"; }

            reportData.push({ ...sig, maxGain, verdict, icon });

        } catch (e) {
            console.error(`Error on ${sig.symbol}`, e.message);
        }
    }

    reportData.sort((a, b) => a.time.localeCompare(b.time));

    // Generate Report
    let md = `# 🕵️‍♂️ Detailed Pre-Breakout Backtest (8 Jan 2026)\n\n`;
    md += `**Total Symbols:** ${totalSymbols}\n`;
    md += `**Signals Detected:** ${reportData.length}\n`;
    md += `**Breakout Success Rate:** ${(reportData.filter(r => r.maxGain >= 1.0).length / reportData.length * 100).toFixed(1)}%\n\n`;

    md += `| ⏰ Time (UTC) | Symbol | Signal Price | Tightness | Vol Pulse | Proximity | Max Gain | Verdict |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;

    reportData.forEach(r => {
        md += `| ${r.time.split('T')[1].replace('Z', '')} | **${r.symbol}** | ${r.price} | ${(r.tightness * 100).toFixed(2)}% | ${r.volPulse.toFixed(1)}x | ${(r.proximity * 100).toFixed(2)}% | **${r.maxGain.toFixed(2)}%** | ${r.icon} ${r.verdict} |\n`;
    });

    writeFileSync('backtest_final_report.md', md);
    console.log("\n✅ Report Generated: backtest_final_report.md");
    console.log(md);
}

runBacktest().catch(console.error);

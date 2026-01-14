import https from 'node:https';
import fs from 'node:fs';

const RAILWAY_QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

// SQL to run analysis entirely on server
// 1. Calculate metrics for all bars
// 2. Filter signals
// 3. Find first signal per symbol
// 4. Join with session high/close to find gains
const sql = `
WITH 
  market_bar AS (
    SELECT 
      symbol, 
      timestamp, 
      close, 
      high,
      sum(volume) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) / 15 as w_avg_vol,
      max(high) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_high,
      min(low) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_low,
      max(high) OVER (PARTITION BY symbol ORDER BY timestamp ROWS UNBOUNDED PRECEDING) as session_high
    FROM trades 
    WHERE timestamp BETWEEN '2026-01-08T04:30:00.000000Z' AND '2026-01-08T10:30:00.000000Z'
    SAMPLE BY 1m ALIGN TO CALENDAR FILL(PREV)
  ),
  signals AS (
    SELECT 
      symbol,
      timestamp as signal_time,
      close as signal_price,
      (w_high - w_low) / close as tightness,
      CASE WHEN w_avg_vol > 0 THEN volume / w_avg_vol ELSE 0 END as vol_pulse,
      (session_high - close) / session_high as proximity
    FROM market_bar
    WHERE 
      (w_high - w_low) / close < 0.015
      AND (CASE WHEN w_avg_vol > 0 THEN volume / w_avg_vol ELSE 0 END) > 3.0
      AND (session_high - close) / session_high < 0.03
  ),
  first_signals AS (
    SELECT symbol, min(signal_time) as first_signal_time 
    FROM signals 
    GROUP BY symbol
  ),
  signal_details AS (
    SELECT s.* 
    FROM signals s
    JOIN first_signals f ON s.symbol = f.symbol AND s.signal_time = f.first_signal_time
  ),
  future_price AS (
    SELECT 
      s.symbol,
      max(t.price) as max_future_high,
      last(t.price) as final_close
    FROM signal_details s
    JOIN trades t ON t.symbol = s.symbol AND t.timestamp > s.signal_time
    WHERE t.timestamp <= '2026-01-08T10:30:00.000000Z'
    GROUP BY s.symbol
  )
SELECT 
  s.symbol,
  s.signal_time,
  s.signal_price,
  s.tightness,
  s.vol_pulse,
  s.proximity,
  f.max_future_high,
  f.final_close
FROM signal_details s
LEFT JOIN future_price f ON s.symbol = f.symbol
ORDER BY s.signal_time
`;

// Note: QuestDB SQL dialect limitations might require tweaking (e.g. JOIN support in CTEs)
// QuestDB has limited CTE support. Let's try a simplified query if complex one fails.
// Actually, QuestDB CTE support is valid but strictly ordered.
// Alternatively, we can do it in two steps if one giant query fails.

// Let's try a robust single query first, but simplified for QuestDB
// QuestDB doesn't support random JOINs well in old versions.
// We will simply fetch ALL SIGNALS first (much smaller than all data), then post-process gains.

const signalSql = `
    SELECT 
        symbol,
        timestamp,
        close,
        (max(high) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) - 
         min(low) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW)) / close as tightness,
        
        volume / (sum(volume) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) / 15) as vol_pulse,
        
        (max(high) OVER (PARTITION BY symbol ORDER BY timestamp ROWS UNBOUNDED PRECEDING) - close) / 
         max(high) OVER (PARTITION BY symbol ORDER BY timestamp ROWS UNBOUNDED PRECEDING) as proximity
         
    FROM (
        SELECT symbol, timestamp, last(price) as close, max(price) as high, min(price) as low, sum(volume) as volume
        FROM trades 
        WHERE timestamp BETWEEN '2026-01-08T04:30:00.000000Z' AND '2026-01-08T10:30:00.000000Z'
        SAMPLE BY 1m ALIGN TO CALENDAR FILL(PREV)
    )
`;

// Fetching all calculated metrics is still big.
// We should filter on server.

const filteredSql = `
    SELECT * FROM (
        ${signalSql}
    ) 
    WHERE tightness < 0.015 AND vol_pulse > 3.0 AND proximity < 0.030
    ORDER BY timestamp
`;

function query(sql) {
    return new Promise((resolve, reject) => {
        const url = `${RAILWAY_QUESTDB_URL}?query=${encodeURIComponent(sql)}&count=true`;
        https.get(url, { rejectUnauthorized: false, timeout: 60000 }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function run() {
    console.log("🔍 Running server-side signal detection...");

    // 1. Get Signals
    let signals;
    try {
        const res = await query(filteredSql);
        signals = res.dataset;
        if (!signals || signals.length === 0) {
            console.log("❌ No signals found.");
            return;
        }
        console.log(`✅ Found ${signals.length} signal minutes.`);
    } catch (e) {
        console.error("Query failed:", e.message);
        return;
    }

    // 2. Filter to First Signal per Symbol
    const firstSignals = {};
    signals.forEach(row => {
        const [sym, ts, price, t, v, p] = row;
        if (!firstSignals[sym]) {
            firstSignals[sym] = {
                sym,
                ts: new Date(ts),
                price,
                metrics: { t, v, p }
            };
        }
    });

    const uniqueSymbols = Object.keys(firstSignals);
    console.log(`✅ Identified ${uniqueSymbols.length} unique symbols for replay.`);

    // 3. Get Outcome for each symbol (Max High after signal)
    // We can do this efficiently by querying max(price) for each symbol after its signal time
    const report = [];

    for (const sym of uniqueSymbols) {
        const sig = firstSignals[sym];
        const tsStr = sig.ts.toISOString();

        // Query future performance
        const outcomeSql = `
            SELECT max(price), last(price) 
            FROM trades 
            WHERE symbol = '${sym}' 
              AND timestamp > '${tsStr}' 
              AND timestamp <= '2026-01-08T10:30:00.000000Z'
        `;

        try {
            const res = await query(outcomeSql);
            const [maxHigh, finalClose] = res.dataset[0];

            const maxGain = ((maxHigh - sig.price) / sig.price) * 100;
            const finalGain = ((finalClose - sig.price) / sig.price) * 100;

            let verdict = "⚖️ CHOPPY";
            let icon = "⚪";
            if (maxGain >= 2.0 && finalGain >= 1.0) { verdict = "🚀 SUPER BREAKOUT"; icon = "🟢"; }
            else if (maxGain >= 1.0 && finalGain >= 0.5) { verdict = "✅ TRUE BREAKOUT"; icon = "🟢"; }
            else if (maxGain >= 1.0) { verdict = "⚠️ FAKEOUT"; icon = "🔴"; }
            else if (maxGain < 0.5) { verdict = "💤 DUD"; icon = "⚪"; }

            report.push({
                time: tsStr.split('T')[1].replace('Z', ''),
                symbol: sym,
                price: sig.price,
                tightness: (sig.metrics.t * 100).toFixed(1),
                volPulse: sig.metrics.v.toFixed(1),
                proximity: (sig.metrics.p * 100).toFixed(1),
                maxGain: maxGain.toFixed(2),
                verdict,
                icon
            });

        } catch (e) {
            console.error(`Error processing ${sym}:`, e.message);
        }
    }

    report.sort((a, b) => a.time.localeCompare(b.time));

    let md = `# 📊 Detailed Pre-Breakout Backtest Report (8 Jan 2026)\n\n`;
    md += `> **Method:** Server-side SQL analysis of raw trades.\n`;
    md += `> **Signals Detected:** ${report.length}\n\n`;

    md += `| Time (UTC) | Symbol | Signal Price | Tightness | Pulse | Proximity | Max Gain | Verdict |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;

    report.forEach(r => {
        md += `| ${r.time} | **${r.symbol}** | ${r.price} | ${r.tightness}% | ${r.volPulse}x | ${r.proximity}% | **${r.maxGain}%** | ${r.icon} ${r.verdict} |\n`;
    });

    fs.writeFileSync('backtest_final_report.md', md);
    console.log("✅ Report saved: backtest_final_report.md");
    console.log(md);
}

run();

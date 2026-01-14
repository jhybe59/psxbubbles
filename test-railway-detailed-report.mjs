// Detailed Pre‑Breakout + Breakout Time Report (Railway QuestDB)
import https from 'node:https';
import { writeFileSync } from 'node:fs';

const RAILWAY_QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

function queryQuestDB(sql) {
    return new Promise((resolve, reject) => {
        const url = `${RAILWAY_QUESTDB_URL}?query=${encodeURIComponent(sql)}&count=true`;
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

async function generateDetailedReport() {
    const dayStart = '2026-01-08T04:00:00.000Z'; // market open (PKT 9:30)
    const dayEnd = '2026-01-08T10:30:00.000Z'; // market close (PKT 15:30)

    // 1️⃣ Trade & symbol counts
    const totalTrades = (await queryQuestDB(`SELECT count() FROM trades WHERE timestamp >= '${dayStart}'`)).dataset?.[0]?.[0] ?? 0;
    const totalSymbols = (await queryQuestDB(`SELECT count(DISTINCT symbol) FROM trades WHERE timestamp >= '${dayStart}'`)).dataset?.[0]?.[0] ?? 0;

    // 2️⃣ Pre‑Breakout + latest bar timestamp per symbol
    const sql = `
    WITH m1_bars AS (
      SELECT symbol, timestamp,
        first(price) as open,
        max(price) as high,
        min(price) as low,
        last(price) as close,
        sum(volume) as volume,
        sum(value) as value,
        avg(daily_pct) as daily_pct
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
        avg(m.volume) OVER (PARTITION BY m.symbol ORDER BY m.timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_avg_vol,
        max(timestamp) OVER (PARTITION BY m.symbol) as last_ts
      FROM m1_bars m
      JOIN session_stats s ON m.symbol = s.symbol
    ),
    derived_metrics AS (
      SELECT *, (volume / NULLIF(w_avg_vol,0)) as calc_pulse FROM window_stats
    ),
    ranked_pulse AS (
      SELECT *, row_number() OVER (PARTITION BY symbol ORDER BY calc_pulse DESC) as rn FROM derived_metrics
    )
    SELECT symbol, close, session_high,
      (w_high - w_low) / NULLIF(close,0) as tightness,
      calc_pulse as vol_pulse,
      (session_high - close) / NULLIF(session_high,0) as proximity,
      last_ts
    FROM ranked_pulse
    WHERE rn = 1
  `;

    const result = await queryQuestDB(sql);
    const rows = result?.dataset ?? [];

    const TIGHTNESS_THRESHOLD = 0.015;
    const VOL_PULSE_THRESHOLD = 3.0;
    const PROXIMITY_THRESHOLD = 0.030;

    const matches = [];
    for (const row of rows) {
        const [symbol, close, session_high, tightness, vol_pulse, proximity, last_ts] = row;
        if (tightness < TIGHTNESS_THRESHOLD && vol_pulse > VOL_PULSE_THRESHOLD && proximity < PROXIMITY_THRESHOLD) {
            matches.push({ symbol, close, session_high, tightness, vol_pulse, proximity, last_ts });
        }
    }

    // Build markdown report
    let md = `# Detailed Pre‑Breakout & Breakout‑Time Report – 8 Jan 2026 (Railway QuestDB)\n\n`;
    md += `**Total trades (since market open):** ${totalTrades}\n\n`;
    md += `**Total symbols observed:** ${totalSymbols}\n\n`;
    md += `**Symbols meeting all Pre‑Breakout criteria:** ${matches.length}\n\n`;
    const successRate = totalSymbols ? ((matches.length / totalSymbols) * 100).toFixed(2) : '0';
    md += `**Success rate:** ${successRate}% of symbols\n\n`;

    if (matches.length) {
        md += `## Matching Symbols (Potential Breakouts)\n\n| Symbol | Tightness % | Vol Pulse × | Proximity % | Breakout Time (UTC) | Classification |
|--------|------------|------------|------------|----------------------|----------------|
`;
        for (const m of matches) {
            const time = new Date(m.last_ts).toISOString();
            // Simple classification: if proximity < 0.01 consider confirmed breakout, else potential
            const classification = m.proximity < 0.01 ? 'Breakout' : 'Potential Breakout';
            md += `| ${m.symbol} | ${(m.tightness * 100).toFixed(3)} | ${m.vol_pulse.toFixed(2)} | ${(m.proximity * 100).toFixed(2)} | ${time} | ${classification} |
`;
        }
    } else {
        md += `No symbols satisfied all three thresholds today.\n`;
    }

    const reportPath = 'prebreakout_detailed_railway_report.md';
    writeFileSync(reportPath, md);
    console.log('Report written to', reportPath);
}

generateDetailedReport().catch(err => console.error('Error generating report:', err));

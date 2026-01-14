
import fs from 'fs';

// Helper to manually parse CSV lines
function parseCSV(content) {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!row) continue;

        const obj = {};
        headers.forEach((h, index) => {
            let val = row[index] ? row[index].trim() : '';
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            obj[h] = val;
        });

        if (!obj.Symbol) {
            const parts = lines[i].split(',');
            const firstComma = lines[i].indexOf(',');
            const secondQuote = lines[i].indexOf('"', firstComma + 2);

            obj.Symbol = lines[i].substring(0, firstComma);
            obj.Time_PKT = lines[i].substring(firstComma + 2, secondQuote);

            const rest = lines[i].substring(secondQuote + 2).split(',');
            obj.Open = rest[0];
            obj.Close = rest[1];
            obj.ChangePct = rest[2];
            obj.Duration = rest[3];
            obj.Volume = rest[4];
            obj.RVOL = rest[5];
        }

        data.push(obj);
    }
    return data;
}

const QUESTDB_URL = 'http://localhost:9000/exec';
const CSV_FILE = 'breakouts_strict.csv';

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
    console.log("Generating Audit Report (with Infinite Pulse Logic)...");
    console.log('─'.repeat(70));

    if (!fs.existsSync(CSV_FILE)) {
        console.error(`File ${CSV_FILE} not found!`);
        return;
    }

    const fileContent = fs.readFileSync(CSV_FILE, 'utf8');
    const records = parseCSV(fileContent);

    // Generate Markdown Report Header
    const reportPath = 'breakout_detection_audit.md';
    let report = `# Breakout Detection Audit\n\n`;
    report += `**Settings:** Relaxed (Tight < 5%, Vol > 1.5x) + Flash Wake-up (Vol > 5x) + Infinite Wakeup (Vol > 50x)\n`;
    report += `**Total Events:** ${records.length}\n\n`;
    report += `| Symbol | Time (PKT) | Status | Detection Details |\n`;
    report += `|---|---|---|---|\n`;

    let caughtByPreBreakout = 0;

    for (const rec of records) {
        const { Symbol, Time_PKT, RVOL } = rec;

        const tsDate = new Date(Time_PKT);
        const isoTs = tsDate.toISOString();

        // 2. Fetch Lead Metrics
        // We add 1 second to isoTs to ensure we capture the breakout trades responsible for the wake-up.
        // CSV timestamp is second-precision (HH:mm:ss), DB is microsecond. 
        // trades at :ss.123 would be missed by <= :ss.000
        const preSql = `
            WITH 
            price_bars AS (
                SELECT 
                    timestamp,
                    first(price) as open,
                    max(price) as high,
                    min(price) as low,
                    last(price) as close
                FROM trades
                WHERE symbol = '${Symbol}' AND timestamp <= dateadd('s', 1, '${isoTs}') AND timestamp > dateadd('m', -15, '${isoTs}')
                SAMPLE BY 1m FILL(PREV) ALIGN TO CALENDAR
            ),
            vol_bars AS (
                SELECT
                    timestamp,
                    sum(volume) as volume
                FROM trades
                WHERE symbol = '${Symbol}' AND timestamp <= dateadd('s', 1, '${isoTs}') AND timestamp > dateadd('m', -15, '${isoTs}')
                SAMPLE BY 1m FILL(0) ALIGN TO CALENDAR
            ),
            m1_bars AS (
                SELECT 
                    p.timestamp,
                    p.open,
                    p.high,
                    p.low,
                    p.close,
                    v.volume
                FROM price_bars p
                JOIN vol_bars v ON p.timestamp = v.timestamp
            ),
            window_stats AS (
                SELECT 
                    timestamp,
                    close,
                    volume,
                    -- Tightness: Range of last 15 minutes
                    max(high) OVER (ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_high,
                    min(low) OVER (ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_low,
                    -- Average Volume: Last 15 minutes
                    avg(volume) OVER (ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_avg_vol,
                    max(high) OVER (ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as session_high
                FROM m1_bars
            ),
            derived_metrics AS (
                SELECT
                    *,
                    CASE 
                        WHEN w_avg_vol = 0 AND volume > 0 THEN 100.0
                        WHEN w_avg_vol = 0 AND volume = 0 THEN 0.0
                        ELSE (volume / w_avg_vol)
                    END as raw_pulse
                FROM window_stats
            ),
            smoothed_metrics AS (
                SELECT
                    *,
                    -- Sustained Signal: Look back 5 minutes
                    max(raw_pulse) OVER (ORDER BY timestamp ROWS BETWEEN 5 PRECEDING AND CURRENT ROW) as calc_pulse
                FROM derived_metrics
            )
            SELECT 
                last((w_high - w_low) / w_high) as tightness,
                last(calc_pulse) as vol_pulse,
                last((session_high - close) / session_high) as proximity
            FROM smoothed_metrics
        `;

        const preRes = await queryQuestDB(preSql);
        let statusIcon = '❌';
        let statusText = 'Missed';
        let details = '';

        if (preRes && preRes.dataset && preRes.dataset.length > 0) {
            const [tightness, vol_pulse, proximity] = preRes.dataset[0];
            const metrics = {
                tightness: tightness || 0,
                vol_pulse: vol_pulse || 0,
                proximity: proximity || 0
            };

            // Standard
            const TIGHTNESS_THRESHOLD = 0.05;
            const VOL_PULSE_THRESHOLD = 1.5;
            const PROXIMITY_THRESHOLD = 0.10;

            const passTight = metrics.tightness < TIGHTNESS_THRESHOLD;
            const passPulse = metrics.vol_pulse > VOL_PULSE_THRESHOLD;
            const passProx = metrics.proximity < PROXIMITY_THRESHOLD;

            // Wakeup
            const WAKEUP_VOL_THRESHOLD = 5.0;
            const WAKEUP_PROX_THRESHOLD = 0.15;
            const passWakeupVol = metrics.vol_pulse > WAKEUP_VOL_THRESHOLD;
            const passWakeupProx = metrics.proximity < WAKEUP_PROX_THRESHOLD;

            // Infinite Wakeup (Override)
            const isInfiniteWakeup = metrics.vol_pulse >= 50.0;

            const isStandard = passTight && passPulse && passProx;
            const isWakeup = passWakeupVol && passWakeupProx;

            if (isStandard || isWakeup || isInfiniteWakeup) {
                statusIcon = '✅';
                if (isInfiniteWakeup) statusText = 'Infinite Wakeup';
                else if (isWakeup) statusText = 'Flash';
                else statusText = 'Standard';

                caughtByPreBreakout++;
                details = `V:${metrics.vol_pulse.toFixed(1)}x T:${(metrics.tightness * 100).toFixed(1)}%`;
            } else {
                let reasons = [];
                if (!passTight) reasons.push(`Tight ${(metrics.tightness * 100).toFixed(1)}%`);
                if (!passPulse) reasons.push(`Vol ${metrics.vol_pulse.toFixed(1)}x`);
                if (!passProx) reasons.push(`Prox ${(metrics.proximity * 100).toFixed(1)}%`);

                details = reasons.join(', ');
            }
        } else {
            details = 'Insufficient Data';
        }

        // Show full date and time
        report += `| ${Symbol} | ${Time_PKT} | ${statusIcon} ${statusText} | ${details} |\n`;
        process.stdout.write('.');
    }

    report += `\n**Final Detection Rate:** ${caughtByPreBreakout}/${records.length} (${((caughtByPreBreakout / records.length) * 100).toFixed(1)}%)\n`;
    fs.writeFileSync(reportPath, report);
    console.log(`\n\nReport saved to ${reportPath}`);
}

main();

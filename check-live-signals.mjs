
const QUESTDB_URL = 'http://localhost:9000/exec';

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
    console.log("Checking for Active Pre-Breakout Signals at Market Close...");

    // Get the very latest timestamp available in trades
    const lastTsRes = await queryQuestDB("SELECT max(timestamp) as last_ts FROM trades");
    if (!lastTsRes || !lastTsRes.dataset.length) {
        console.log("No data found.");
        return;
    }
    const lastTs = lastTsRes.dataset[0][0]; // format: '2026-01-14T...'
    console.log(`Latest Market Time: ${lastTs}`);

    // Check last 15 minutes leading up to this time
    const sql = `
        WITH 
        last_trades AS (
            SELECT symbol FROM trades WHERE timestamp > dateadd('m', -15, '${lastTs}') SAMPLE BY 1d
        ),
        price_bars AS (
            SELECT 
                symbol,
                timestamp,
                first(price) as open,
                max(price) as high,
                min(price) as low,
                last(price) as close
            FROM trades
            WHERE timestamp <= '${lastTs}' AND timestamp > dateadd('m', -15, '${lastTs}')
            SAMPLE BY 1m FILL(PREV) ALIGN TO CALENDAR
        ),
        vol_bars AS (
            SELECT
                symbol,
                timestamp,
                sum(volume) as volume
            FROM trades
            WHERE timestamp <= '${lastTs}' AND timestamp > dateadd('m', -15, '${lastTs}')
            SAMPLE BY 1m FILL(0) ALIGN TO CALENDAR
        ),
        m1_bars AS (
            SELECT 
                p.symbol,
                p.timestamp,
                p.close,
                v.volume,
                p.high,
                p.low
            FROM price_bars p
            JOIN vol_bars v ON p.symbol = v.symbol AND p.timestamp = v.timestamp
        ),
        stats AS (
            SELECT
                symbol,
                timestamp,
                max(high) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_high,
                min(low) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_low,
                avg(volume) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_avg_vol,
                max(high) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as session_high,
                close,
                volume
            FROM m1_bars
        ),
        derived_metrics AS (
            SELECT
                symbol,
                timestamp,
                (w_high - w_low) / w_high as tightness,
                (session_high - close) / session_high as proximity,
                CASE 
                    WHEN w_avg_vol = 0 AND volume > 0 THEN 100.0
                    WHEN w_avg_vol = 0 AND volume = 0 THEN 0.0
                    ELSE (volume / w_avg_vol)
                END as raw_pulse
            FROM stats
        ),
        final_metrics AS (
            SELECT
                symbol,
                last(tightness) as tightness,
                last(proximity) as proximity,
                max(raw_pulse) as max_pulse_5m -- Check ANY strong pulse in last 5m (approx, usually query does this)
            FROM derived_metrics
            -- To correctly do "last 5m max pulse" for "current status", we need window func again, 
            -- but for simplicity let's just check if ANY pulse in this 15m window was huge.
            -- Actually, "Sustained Signal" logic in app checks strictly last 5m.
            -- Let's stick to last row for tightness/prox and see if we can get max pulse efficiently.
            SAMPLE BY 1d
        )
        SELECT * FROM derived_metrics ORDER BY timestamp DESC LIMIT 100
    `;

    // Simplified query to just get "current status" of all symbols
    const currentStatusSql = `
        WITH 
        active_symbols AS (
             SELECT DISTINCT symbol FROM trades WHERE timestamp > dateadd('m', -15, '${lastTs}')
        ),
        m1_bars AS (
            SELECT 
                symbol,
                timestamp,
                first(price) as open,
                max(price) as high,
                min(price) as low,
                last(price) as close,
                sum(volume) as volume
            FROM trades
            WHERE timestamp <= '${lastTs}' AND timestamp > dateadd('m', -15, '${lastTs}')
            SAMPLE BY 1m FILL(NULL) ALIGN TO CALENDAR
        ),
        window_stats AS (
            SELECT
                symbol,
                timestamp,
                -- 15m Tightness
                max(high) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_high,
                min(low) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_low,
                -- 15m Avg Vol
                avg(volume) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_avg_vol,
                -- Session High (approx for this window)
                max(high) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as session_high,
                close,
                volume
            FROM m1_bars
        ),
        derived AS (
           SELECT
              symbol,
              timestamp,
              (w_high - w_low) / w_high as tightness,
              (session_high - close) / session_high as proximity,
              CASE 
                 WHEN w_avg_vol = 0 AND volume > 0 THEN 100.0
                 WHEN w_avg_vol = 0 AND volume = 0 THEN 0.0
                 ELSE (volume / w_avg_vol)
              END as raw_pulse
           FROM window_stats
        ),
        smoothed AS (
            SELECT
               symbol,
               timestamp,
               tightness,
               proximity,
               max(raw_pulse) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN 5 PRECEDING AND CURRENT ROW) as max_pulse_5m
            FROM derived
        ),
        latest_status AS (
            SELECT 
                symbol, 
                timestamp,
                tightness as t, 
                proximity as p, 
                max_pulse_5m as v,
                row_number() OVER (PARTITION BY symbol ORDER BY max_pulse_5m DESC) as rn
            FROM smoothed
        )
        SELECT * FROM latest_status
        WHERE rn = 1
    `;

    const res = await queryQuestDB(currentStatusSql);
    if (!res || !res.dataset) {
        console.log("Query Error or No Data");
        return;
    }

    // Filter locally to avoid DB complexity
    console.log("Analyzing all returned rows...");
    const candidates = res.dataset.filter(row => {
        const [sym, ts, t, p, v] = row;

        // Debug OBOY specifically
        if (sym === 'OBOY' || sym === 'PAEL') {
            console.log(`DEBUG: ${sym} -> T:${t}, P:${p}, V:${v}`);
        }

        // Criteria:
        // 1. Standard: T < 0.05 AND V > 1.5 AND P < 0.10
        // 2. Flash: V > 5.0 AND P < 0.15
        // 3. Infinite: V >= 50.0
        return (t < 0.05 && v > 1.5 && p < 0.10) || (v > 5.0 && p < 0.15) || (v >= 50.0) || sym === 'OBOY';
    });

    console.log(`\nFound ${candidates.length} Candidates at Market Close:`);
    console.log(`| Symbol | Tightness | Proximity | Max Pulse (5m) | Status |`);
    console.log(`|---|---|---|---|---|`);

    candidates.forEach(row => {
        const [sym, ts, t, p, v] = row;
        let status = "Standard";
        if (v >= 50.0) status = "Infinite Wakeup";
        else if (v > 5.0) status = "Flash Wakeup";
        else if (sym === 'OBOY') status = "DEBUG VIEW";

        console.log(`| ${sym} | ${(t * 100).toFixed(1)}% | ${(p * 100).toFixed(1)}% | ${v.toFixed(1)}x | ${status} |`);
    });
}

main();

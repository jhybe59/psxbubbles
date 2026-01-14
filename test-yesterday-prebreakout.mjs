/**
 * TEST: Pre-Breakout logic on YESTERDAY's data (which we know works)
 */

const QUESTDB_URL = 'http://localhost:9000/exec';

async function queryQuestDB(sql) {
    const response = await fetch(`${QUESTDB_URL}?query=${encodeURIComponent(sql)}&count=true`);
    return response.json();
}

async function testPreBreakoutOnYesterday() {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("TEST: Pre-Breakout Logic on YESTERDAY's Data (7th Jan)");
    console.log("═══════════════════════════════════════════════════════════════\n");

    // Yesterday's dayStart (7th Jan 9:00 AM PKT = 04:00 UTC)
    const dayStart = '2026-01-07T04:00:00.000Z';
    const dayEnd = '2026-01-07T10:30:00.000Z'; // 3:30 PM PKT

    // Full Lead Indicator Query (same as volatility-service.mjs)
    const sql = `
        WITH m1_bars AS (
            SELECT 
                symbol,
                timestamp,
                first(price) as open,
                max(price) as high,
                min(price) as low,
                last(price) as close,
                sum(volume) as volume
            FROM trades
            WHERE timestamp >= '${dayStart}' AND timestamp < '${dayEnd}'
            SAMPLE BY 1m ALIGN TO CALENDAR
        ),
        session_stats AS (
            SELECT 
                symbol,
                max(high) as session_high
            FROM m1_bars
            GROUP BY symbol
        ),
        window_stats AS (
            SELECT 
                m.symbol,
                m.timestamp,
                m.close,
                m.high,
                m.low,
                m.volume,
                s.session_high,
                max(m.high) OVER (PARTITION BY m.symbol ORDER BY m.timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_high,
                min(m.low) OVER (PARTITION BY m.symbol ORDER BY m.timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_low,
                avg(m.volume) OVER (PARTITION BY m.symbol ORDER BY m.timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_avg_vol
            FROM m1_bars m
            JOIN session_stats s ON m.symbol = s.symbol
        ),
        derived_metrics AS (
            SELECT
                *,
                (volume / NULLIF(w_avg_vol, 0)) as calc_pulse
            FROM window_stats
        ),
        ranked_pulse AS (
            SELECT 
                *,
                row_number() OVER (PARTITION BY symbol ORDER BY calc_pulse DESC) as rn
            FROM derived_metrics
        )
        SELECT 
            symbol,
            close,
            session_high,
            (w_high - w_low) / NULLIF(close, 0) as tightness,
            calc_pulse as vol_pulse,
            (session_high - close) / NULLIF(session_high, 0) as proximity
        FROM ranked_pulse
        WHERE rn = 1
    `;

    const result = await queryQuestDB(sql);

    if (!result?.dataset || result.dataset.length === 0) {
        console.log("❌ No data returned!");
        return;
    }

    console.log(`📊 Total symbols with metrics: ${result.dataset.length}\n`);

    // Pre-Breakout Thresholds
    const TIGHTNESS_THRESHOLD = 0.015;  // < 1.5%
    const VOL_PULSE_THRESHOLD = 3.0;    // > 3x
    const PROXIMITY_THRESHOLD = 0.030;  // < 3%

    let preBreakouts = [];

    result.dataset.forEach(row => {
        const [symbol, close, session_high, tightness, vol_pulse, proximity] = row;

        const tightnessPass = tightness < TIGHTNESS_THRESHOLD;
        const volPulsePass = vol_pulse > VOL_PULSE_THRESHOLD;
        const proximityPass = proximity < PROXIMITY_THRESHOLD;

        if (tightnessPass && volPulsePass && proximityPass) {
            preBreakouts.push({
                symbol,
                close,
                tightness: (tightness * 100).toFixed(3),
                vol_pulse: vol_pulse?.toFixed(2),
                proximity: (proximity * 100).toFixed(2)
            });
        }
    });

    console.log(`🎯 PRE-BREAKOUT SIGNALS (meeting ALL criteria):`);
    console.log(`   Tightness < ${TIGHTNESS_THRESHOLD * 100}%`);
    console.log(`   Vol Pulse > ${VOL_PULSE_THRESHOLD}x`);
    console.log(`   Proximity < ${PROXIMITY_THRESHOLD * 100}%\n`);

    if (preBreakouts.length === 0) {
        console.log("   ⚠️ NO symbols met ALL Pre-Breakout criteria\n");

        // Show near-misses
        console.log("📋 NEAR-MISSES (meeting 2 of 3 criteria):");
        result.dataset.slice(0, 20).forEach(row => {
            const [symbol, close, session_high, tightness, vol_pulse, proximity] = row;

            const tightnessPass = tightness < TIGHTNESS_THRESHOLD;
            const volPulsePass = vol_pulse > VOL_PULSE_THRESHOLD;
            const proximityPass = proximity < PROXIMITY_THRESHOLD;

            const passCount = [tightnessPass, volPulsePass, proximityPass].filter(Boolean).length;

            if (passCount === 2) {
                console.log(`   ${symbol}:`);
                console.log(`      Tightness: ${(tightness * 100).toFixed(3)}% ${tightnessPass ? '✓' : '✗'}`);
                console.log(`      Vol Pulse: ${vol_pulse?.toFixed(2)}x ${volPulsePass ? '✓' : '✗'}`);
                console.log(`      Proximity: ${(proximity * 100).toFixed(2)}% ${proximityPass ? '✓' : '✗'}`);
            }
        });
    } else {
        console.log(`   ✅ Found ${preBreakouts.length} Pre-Breakout signals:\n`);
        preBreakouts.forEach(pb => {
            console.log(`   ${pb.symbol}:`);
            console.log(`      Tightness: ${pb.tightness}%`);
            console.log(`      Vol Pulse: ${pb.vol_pulse}x`);
            console.log(`      Proximity: ${pb.proximity}%`);
        });
    }
}

testPreBreakoutOnYesterday().catch(console.error);

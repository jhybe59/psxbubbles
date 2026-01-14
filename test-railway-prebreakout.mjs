import https from 'node:https';

const RAILWAY_QUESTDB_URL = 'https://questdb-production-ec9c.up.railway.app/exec';

function queryQuestDB(sql) {
    return new Promise((resolve, reject) => {
        const url = `${RAILWAY_QUESTDB_URL}?query=${encodeURIComponent(sql)}&count=true`;
        https.get(url, { rejectUnauthorized: false }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`Failed to parse JSON: ${e.message}`));
                    }
                } else {
                    reject(new Error(`HTTP Error ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', (e) => {
            reject(e);
        });
    });
}

async function testPreBreakoutOnRailway() {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("TEST: Pre-Breakout Logic on Railway Production Data (8th Jan)");
    console.log("═══════════════════════════════════════════════════════════════\n");

    // First check data availability
    console.log("📊 CHECKING DATA AVAILABILITY...\n");

    const countSQL = `
        SELECT count() as total_trades, count_distinct(symbol) as symbols
        FROM trades
        WHERE timestamp >= '2026-01-08T04:00:00.000Z'
    `;

    const countResult = await queryQuestDB(countSQL);
    if (countResult?.dataset?.[0]) {
        console.log(`   Total trades today: ${countResult.dataset[0][0]}`);
        console.log(`   Symbols: ${countResult.dataset[0][1]}\n`);
    }

    // Today's dayStart (8th Jan 9:00 AM PKT = 04:00 UTC)
    const dayStart = '2026-01-08T04:00:00.000Z';

    // Full Lead Indicator Query
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
            WHERE timestamp >= '${dayStart}'
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
        console.log("❌ No data returned from Railway QuestDB!");
        console.log("Error:", result?.error || "Unknown error");
        return;
    }

    console.log(`📊 Total symbols with metrics: ${result.dataset.length}\n`);

    // Pre-Breakout Thresholds
    const TIGHTNESS_THRESHOLD = 0.015;  // < 1.5%
    const VOL_PULSE_THRESHOLD = 3.0;    // > 3x
    const PROXIMITY_THRESHOLD = 0.030;  // < 3%

    let preBreakouts = [];
    let nearMisses = [];

    result.dataset.forEach(row => {
        const [symbol, close, session_high, tightness, vol_pulse, proximity] = row;

        const tightnessPass = tightness !== null && tightness < TIGHTNESS_THRESHOLD;
        const volPulsePass = vol_pulse !== null && vol_pulse > VOL_PULSE_THRESHOLD;
        const proximityPass = proximity !== null && proximity < PROXIMITY_THRESHOLD;

        const passCount = [tightnessPass, volPulsePass, proximityPass].filter(Boolean).length;

        if (passCount === 3) {
            preBreakouts.push({
                symbol,
                close,
                tightness: (tightness * 100).toFixed(3),
                vol_pulse: vol_pulse?.toFixed(2),
                proximity: (proximity * 100).toFixed(2)
            });
        } else if (passCount === 2) {
            nearMisses.push({
                symbol,
                close,
                tightness,
                tightnessPass,
                vol_pulse,
                volPulsePass,
                proximity,
                proximityPass
            });
        }
    });

    console.log(`🎯 PRE-BREAKOUT SIGNALS (meeting ALL criteria):`);
    console.log(`   Tightness < ${TIGHTNESS_THRESHOLD * 100}%`);
    console.log(`   Vol Pulse > ${VOL_PULSE_THRESHOLD}x`);
    console.log(`   Proximity < ${PROXIMITY_THRESHOLD * 100}%\n`);

    if (preBreakouts.length === 0) {
        console.log("   ⚠️ NO symbols met ALL Pre-Breakout criteria today\n");
    } else {
        console.log(`   ✅ Found ${preBreakouts.length} Pre-Breakout signals:\n`);
        preBreakouts.forEach(pb => {
            console.log(`   ${pb.symbol}:`);
            console.log(`      Price: ${pb.close}`);
            console.log(`      Tightness: ${pb.tightness}%`);
            console.log(`      Vol Pulse: ${pb.vol_pulse}x`);
            console.log(`      Proximity: ${pb.proximity}%`);
            console.log();
        });
    }

    if (nearMisses.length > 0) {
        console.log(`\n📋 NEAR-MISSES (meeting 2 of 3 criteria): ${nearMisses.length}\n`);
        nearMisses.slice(0, 10).forEach(nm => {
            console.log(`   ${nm.symbol}:`);
            console.log(`      Tightness: ${(nm.tightness * 100).toFixed(3)}% ${nm.tightnessPass ? '✓' : '✗'}`);
            console.log(`      Vol Pulse: ${nm.vol_pulse?.toFixed(2)}x ${nm.volPulsePass ? '✓' : '✗'}`);
            console.log(`      Proximity: ${(nm.proximity * 100).toFixed(2)}% ${nm.proximityPass ? '✓' : '✗'}`);
            console.log();
        });
    }
}

testPreBreakoutOnRailway().catch(err => {
    console.error("Error:", err.message);
});

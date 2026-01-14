/**
 * TEST: Check if ALIGN TO CALENDAR fixes the bar count issue
 */

const QUESTDB_URL = 'http://localhost:9000/exec';

async function queryQuestDB(sql) {
    const encodedQuery = encodeURIComponent(sql);
    const response = await fetch(`${QUESTDB_URL}?query=${encodedQuery}&count=true`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
    return response.json();
}

async function testAlignToCalendar() {
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("TEST: SAMPLE BY 1m vs SAMPLE BY 1m ALIGN TO CALENDAR");
    console.log("═══════════════════════════════════════════════════════════════════\n");

    const dayStart = '2026-01-08T04:00:00.000Z';

    // WITHOUT ALIGN TO CALENDAR (current broken implementation)
    console.log("❌ WITHOUT ALIGN TO CALENDAR:");
    const withoutAlignSQL = `
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
            WHERE symbol IN ('PAEL', 'TREET', 'BBFL') AND timestamp >= '${dayStart}'
            SAMPLE BY 1m
        )
        SELECT symbol, count() as bar_count, min(timestamp) as first_bar, max(timestamp) as last_bar
        FROM m1_bars
        GROUP BY symbol
    `;

    const withoutResult = await queryQuestDB(withoutAlignSQL);
    if (withoutResult?.dataset) {
        withoutResult.dataset.forEach(row => {
            console.log(`   ${row[0]}: ${row[1]} bars | First: ${row[2]} | Last: ${row[3]}`);
        });
    }

    // WITH ALIGN TO CALENDAR (proposed fix)
    console.log("\n✅ WITH ALIGN TO CALENDAR:");
    const withAlignSQL = `
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
            WHERE symbol IN ('PAEL', 'TREET', 'BBFL') AND timestamp >= '${dayStart}'
            SAMPLE BY 1m ALIGN TO CALENDAR
        )
        SELECT symbol, count() as bar_count, min(timestamp) as first_bar, max(timestamp) as last_bar
        FROM m1_bars
        GROUP BY symbol
    `;

    const withResult = await queryQuestDB(withAlignSQL);
    if (withResult?.dataset) {
        withResult.dataset.forEach(row => {
            console.log(`   ${row[0]}: ${row[1]} bars | First: ${row[2]} | Last: ${row[3]}`);
        });
    }

    // Full lead metrics query with fix
    console.log("\n📊 FULL LEAD METRICS WITH FIX:");
    const leadSQL = `
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
            WHERE symbol IN ('PAEL', 'TREET') AND timestamp >= '${dayStart}'
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

    const leadResult = await queryQuestDB(leadSQL);
    if (leadResult?.dataset) {
        const cols = leadResult.columns.map(c => c.name);
        console.log(`   Columns: ${cols.join(', ')}`);
        leadResult.dataset.forEach(row => {
            console.log(`\n   ${row[0]}:`);
            console.log(`     close: ${row[1]}`);
            console.log(`     session_high: ${row[2]}`);
            console.log(`     tightness: ${(row[3] * 100).toFixed(3)}%`);
            console.log(`     vol_pulse: ${row[4]?.toFixed(2)}x`);
            console.log(`     proximity: ${(row[5] * 100).toFixed(2)}%`);
        });
    }
}

testAlignToCalendar().catch(console.error);

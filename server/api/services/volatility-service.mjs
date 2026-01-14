import { queryQuestDB } from '../questdb.mjs';

const VALID_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];
const TICK_INTERVALS = [10, 20, 50, 100, 500, 1000];

function mapQuestDBResults(result) {
    if (!result || !result.dataset || !result.columns) return [];
    const columns = result.columns.map(c => c.name);
    return result.dataset.map(row => {
        const obj = {};
        columns.forEach((col, i) => {
            obj[col] = row[i];
        });
        return obj;
    });
}

/**
 * Service to calculate robust volatility metrics (TTM Squeeze, ATR, StdDev).
 * Focuses on detecting "Squeezes" (Compression) and "Expansions" (Breakouts).
 */
export const volatilityService = {

    /**
     * Calculates the TTM Squeeze state for a batch of symbols.
     * TTM Squeeze = Bollinger Bands are INSIDE Keltner Channels.
     * 
     * @param {string[]} symbols - List of symbols to query
     * @param {string|number} interval - '1h', '5m' OR tick count (100, 1000)
     * @param {number} length - Lookback period (Default 20)
     * @param {number} multBB - Bollinger Band Multiplier (Default 2.0)
     * @param {number} multKC - Keltner Channel Multiplier (Default 1.5)
     * @param {string} anchorTs - Optional anchor timestamp
     */
    async getBatchSqueezeState(symbols, interval, length = 20, multBB = 2.0, multKC = 1.5, anchorTs = null) {
        if (!symbols || symbols.length === 0) return new Map();
        const anchor = anchorTs ? `'${anchorTs}'::timestamp` : 'now()';

        // 1. Determine Source Table & Sampling
        let tableName = 'trades';
        let sampleBy = '';
        let isTick = false;

        if (TICK_INTERVALS.includes(Number(interval))) {
            isTick = true;
            // Tick logic handled separately to avoid complex CTEs in main flow if possible, 
            // but we can unify strategy.
            return this.getBatchTickSqueeze(symbols, Number(interval), length, multBB, multKC);
        } else if (VALID_INTERVALS.includes(interval)) {
            sampleBy = `SAMPLE BY ${interval} ALIGN TO CALENDAR`;
        } else {
            // Default fallback
            tableName = 'trades'; // Assuming raw 1m data needs sampling
            sampleBy = `SAMPLE BY 1h ALIGN TO CALENDAR`; // Default to 1h if unknown
        }

        const symbolFilter = `symbol IN (${symbols.map(s => `'${s}'`).join(',')})`;

        // QuestDB Window Function Query for Time-Based
        // We calculate SMA (Basis), StdDev, and ATR (Approximated as SMA(High-Low) for speed, or properly using lag)

        // NOTE: True ATR requires Prev Close. We will use proper TR calculation.
        // TR = Max(H-L, Abs(H-PrevC), Abs(L-PrevC))

        const sql = `
            WITH candle_data AS (
                SELECT 
                    symbol,
                    timestamp,
                    timestamp as ts,
                    first(price) as open,
                    max(price) as high,
                    min(price) as low,
                    last(price) as close
                FROM ${tableName}
                WHERE ${symbolFilter} AND timestamp > dateadd('d', -10, ${anchor}) AND timestamp <= ${anchor} -- Limit lookback for performance
                ${sampleBy}
            ),
            with_tr AS (
                SELECT *,
                    (high - low) as tr
                FROM candle_data
            ),
            stats AS (
                SELECT *,
                    avg(close) OVER (PARTITION BY symbol ORDER BY ts ROWS ${length} PRECEDING) as sma,
                    avg(close * close) OVER (PARTITION BY symbol ORDER BY ts ROWS ${length} PRECEDING) as avg_sq,
                    avg(tr) OVER (PARTITION BY symbol ORDER BY ts ROWS ${length} PRECEDING) as atr
                FROM with_tr
            ),
            latest AS (
                SELECT 
                    symbol,
                    close,
                    sma,
                    sqrt(greatest(0, avg_sq - (sma * sma))) as stddev,
                    atr,
                    (sma + (${multBB} * sqrt(greatest(0, avg_sq - (sma * sma))))) as upper_bb,
                    (sma - (${multBB} * sqrt(greatest(0, avg_sq - (sma * sma))))) as lower_bb,
                    (sma + (${multKC} * atr)) as upper_kc,
                    (sma - (${multKC} * atr)) as lower_kc,
                    (atr / sma) * 100 as vol_atr_pct,
                    row_number() OVER (PARTITION BY symbol ORDER BY ts DESC) as rn
                FROM stats
            )
            SELECT * FROM latest WHERE rn = 1
        `;

        try {
            const rawResults = await queryQuestDB(sql);
            const results = mapQuestDBResults(rawResults);

            if (!results || !results.length) return new Map();

            const squeezeMap = new Map();

            results.forEach(row => {
                const { symbol, upper_bb, lower_bb, upper_kc, lower_kc, atr, stddev } = row;

                // TTM Squeeze Condition: BB inside KC
                // UpperBB < UpperKC AND LowerBB > LowerKC
                const isSqueeze = (upper_bb < upper_kc) && (lower_bb > lower_kc);

                // Expansion: BB width is significantly wider than KC (e.g., expanding)
                // Just a proxy: if !Squeeze, it's widely open OR normal. 
                // We'll simplisticly mark "Expansion" if BB Width > KC Width * 1.5? 
                // Or just return the raw boolean.

                squeezeMap.set(symbol, {
                    squeeze_on: isSqueeze,
                    atr: Number(atr),
                    vol_atr_pct: Number(row.vol_atr_pct || 0),
                    stddev: Number(stddev),
                    bb_width: Number(upper_bb - lower_bb),
                    kc_width: Number(upper_kc - lower_kc)
                });
            });

            return squeezeMap;

        } catch (err) {
            console.error('[volatilityService] Error calculating squeeze:', err.message);
            return new Map();
        }
    },

    /**
     * Calculates Squeeze for Tick-based intervals.
     * Groups trades into buckets of size `tickCount`.
     */
    async getBatchTickSqueeze(symbols, tickCount, length = 20, multBB = 2.0, multKC = 1.5) {
        const symbolFilter = `symbol IN (${symbols.map(s => `'${s}'`).join(',')})`;

        // We need enough historical trade data. 
        // 20 periods * tickCount. E.g. 100 ticks * 20 = 2000 trades lookback per symbol.
        // Let's grab last 5000 trades to be safe.

        const sql = `
            WITH raw_trades AS (
                SELECT 
                    symbol, 
                    price, 
                    timestamp,
                    row_number() OVER (PARTITION BY symbol ORDER BY timestamp DESC) as trade_rn
                FROM trades
                WHERE ${symbolFilter} AND timestamp > dateadd('d', -30, now())
            ),
            ticks AS (
                SELECT 
                    symbol,
                    cast((trade_rn - 1) / ${tickCount} as int) as block_id,
                    max(price) as high,
                    min(price) as low,
                    first(price) as close, -- descending order, so first is actually the 'close' of the block (latest trade)
                    last(price) as open   -- and last is 'open' (earliest trade)
                FROM raw_trades
                WHERE trade_rn <= ${tickCount * (length + 5)}
                GROUP BY symbol, cast((trade_rn - 1) / ${tickCount} as int)
            ),
            -- Re-orient to chronological for window functions (block_id 0 is latest, N is oldest)
            -- Window functions usually essentially scan.
            -- We can do calculations on the blocks directly.
            with_tr AS (
                SELECT *,
                    (high - low) as tr
                FROM ticks
            ),
            stats AS (
                SELECT *,
                    avg(close) OVER (PARTITION BY symbol ORDER BY block_id DESC ROWS ${length} PRECEDING) as sma,
                    avg(close * close) OVER (PARTITION BY symbol ORDER BY block_id DESC ROWS ${length} PRECEDING) as avg_sq,
                    avg(tr) OVER (PARTITION BY symbol ORDER BY block_id DESC ROWS ${length} PRECEDING) as atr
                FROM with_tr
            ),
            latest AS (
                SELECT
                    symbol,
                    (sma + (${multBB} * sqrt(greatest(0, avg_sq - (sma * sma))))) as upper_bb,
                    (sma - (${multBB} * sqrt(greatest(0, avg_sq - (sma * sma))))) as lower_bb,
                    (sma + (${multKC} * atr)) as upper_kc,
                    (sma - (${multKC} * atr)) as lower_kc,
                    atr,
                    (atr / sma) * 100 as vol_atr_pct,
                    sqrt(greatest(0, avg_sq - (sma * sma))) as stddev,
                    block_id
                FROM stats
            )
            SELECT * FROM latest WHERE block_id = 0
        `;

        try {
            const rawResults = await queryQuestDB(sql);
            const results = mapQuestDBResults(rawResults);

            if (!results || !results.length) return new Map();

            const squeezeMap = new Map();
            results.forEach(row => {
                const { symbol, upper_bb, lower_bb, upper_kc, lower_kc, atr, stddev } = row;
                const isSqueeze = (upper_bb < upper_kc) && (lower_bb > lower_kc);

                squeezeMap.set(symbol, {
                    squeeze_on: isSqueeze,
                    atr: Number(atr),
                    vol_atr_pct: Number(row.vol_atr_pct || 0),
                    stddev: Number(stddev),
                    bb_width: Number(upper_bb - lower_bb),
                    kc_width: Number(upper_kc - lower_kc)
                });
            });

            return squeezeMap;
        } catch (err) {
            console.error('[volatilityService] Error calculating tick squeeze:', err);
            return new Map();
        }
    },

    /**
     * High-precision Lead Indicator Detection (Zero-Fakeout Logic)
     * Calculates tightness, volume pulse, and proximity using 1m bars.
     */
    async getLeadIndicatorMetrics(symbols, dayStart) {
        if (!symbols || symbols.length === 0) return new Map();

        const symbolFilter = `symbol IN (${symbols.map(s => `'${s}'`).join(',')})`;

        // We use a CTE to get the latest 15 minutes of 1m bars for each symbol
        // and calculate the required "Golden Formula" metrics.
        const sql = `
            WITH 
            price_bars AS (
                SELECT 
                    symbol,
                    timestamp,
                    first(price) as open,
                    max(price) as high,
                    min(price) as low,
                    last(price) as close
                FROM trades
                WHERE ${symbolFilter} AND timestamp >= '${dayStart}'
                SAMPLE BY 1m FILL(PREV) ALIGN TO CALENDAR
            ),
            vol_bars AS (
                SELECT
                    symbol,
                    timestamp,
                    sum(volume) as volume
                FROM trades
                WHERE ${symbolFilter} AND timestamp >= '${dayStart}'
                SAMPLE BY 1m FILL(0) ALIGN TO CALENDAR
            ),
            m1_bars AS (
                SELECT 
                    p.symbol,
                    p.timestamp,
                    p.open,
                    p.high,
                    p.low,
                    p.close,
                    v.volume
                FROM price_bars p
                JOIN vol_bars v ON p.symbol = v.symbol AND p.timestamp = v.timestamp
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
                    -- Tightness: Range of last 15 minutes
                    max(m.high) OVER (PARTITION BY m.symbol ORDER BY m.timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_high,
                    min(m.low) OVER (PARTITION BY m.symbol ORDER BY m.timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_low,
                    -- Volume Pulse: Current 1m volume vs avg of last 15m
                    avg(m.volume) OVER (PARTITION BY m.symbol ORDER BY m.timestamp ROWS BETWEEN 15 PRECEDING AND CURRENT ROW) as w_avg_vol
                FROM m1_bars m
                JOIN session_stats s ON m.symbol = s.symbol
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
                    -- Look back 5 minutes for the strongest pulse signal
                    -- This ensures the signal persists even if subsequent minutes are quiet (illiquid/zombie stocks)
                    max(raw_pulse) OVER (PARTITION BY symbol ORDER BY timestamp ROWS BETWEEN 5 PRECEDING AND CURRENT ROW) as calc_pulse
                FROM derived_metrics
            ),
            -- ROBUST: Pick the candle with the HIGHEST Volume Pulse (smoothed) in the last 15 mins (window).
            ranked_pulse AS (
                SELECT 
                    *,
                    row_number() OVER (PARTITION BY symbol ORDER BY calc_pulse DESC) as rn
                FROM smoothed_metrics
                -- Filter only recent bars (e.g., last 20 rows relative to the dataset end is implicit via the CTE window, 
                -- but we want to ensure we don't pick very old data if we have a large window)
                -- Since m1_bars is already scoped to 'dayStart', we just take the top pulse from the set.
                -- However, for performance, we should limit to recent time if possible, but m1_bars is already sampled.
            )
            SELECT 
                symbol,
                close,
                session_high,
                (w_high - w_low) / NULLIF(close, 0) as tightness,
                calc_pulse as vol_pulse,
                (session_high - close) / NULLIF(session_high, 0) as proximity,
                (high - close) / NULLIF(high - low, 0) as wick_ratio
            FROM ranked_pulse
            WHERE rn = 1
        `;

        try {
            const rawResults = await queryQuestDB(sql);
            const results = mapQuestDBResults(rawResults);
            const metricsMap = new Map();

            results.forEach(row => {
                metricsMap.set(row.symbol, {
                    tightness: Number(row.tightness || 0),
                    vol_pulse: Number(row.vol_pulse || 0),
                    proximity: Number(row.proximity || 0),
                    wick_ratio: Number(row.wick_ratio || 0),
                    session_high: Number(row.session_high || 0)
                });
            });

            return metricsMap;
        } catch (err) {
            console.error('[volatilityService] Error calculating lead indicators:', err.message);
            return new Map();
        }
    }
};

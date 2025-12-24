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
            sampleBy = `SAMPLE BY ${interval}`;
        } else {
            // Default fallback
            tableName = 'trades'; // Assuming raw 1m data needs sampling
            sampleBy = `SAMPLE BY 1h`; // Default to 1h if unknown
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
                    first(open) as open,
                    max(high) as high,
                    min(low) as low,
                    last(close) as close
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
                    avg(close) OVER (PARTITION BY symbol ORDER BY timestamp ROWS ${length} PRECEDING) as sma,
                    avg(close * close) OVER (PARTITION BY symbol ORDER BY timestamp ROWS ${length} PRECEDING) as avg_sq,
                    avg(tr) OVER (PARTITION BY symbol ORDER BY timestamp ROWS ${length} PRECEDING) as atr
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
                    row_number() OVER (PARTITION BY symbol ORDER BY timestamp DESC) as rn
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
            console.error('[volatilityService] Error calculating squeeze:', err);
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
    }
};

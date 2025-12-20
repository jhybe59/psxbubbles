
export const resolveValue = (coin, field, interval) => {
    // Basic fields
    if (field === 'price') return Number(coin.price || coin.close || 0);
    if (field === 'volume') {
        if (interval === '1d' || interval === 'Day') return Number(coin.day_volume || coin.daily_volume || coin.volume || 0);
        return Number(coin.volume || 0);
    }
    if (field === 'changePct') {
        if (interval === '1d' || interval === 'Day') return Number(coin.daily_change_1d || coin.price_change_percentage_24h || 0);
        return Number(coin.price_change_percentage_24h || coin.interval_pct || 0);
    }
    if (field === 'value') return Number(coin.value || coin.daily_value || 0);
    if (field === 'dailyVolume' || field === 'day_volume') return Number(coin.day_volume || coin.daily_volume || coin.volume || 0);
    if (field === 'dailyChange' || field === 'day_change') return Number(coin.daily_change_1d || coin.pct_24h || 0);

    // Technical Indicators
    if (field === 'rsi') return coin.rsi != null ? Number(coin.rsi) : null;
    if (field === 'sma_20') return coin.sma_20 != null ? Number(coin.sma_20) : null;
    if (field === 'sma_50') return coin.sma_50 != null ? Number(coin.sma_50) : null;
    if (field === 'sma_200') return coin.sma_200 != null ? Number(coin.sma_200) : null;
    if (field === 'ema_20') return coin.ema_20 != null ? Number(coin.ema_20) : null;
    if (field === 'macd') return coin.macd != null ? Number(coin.macd) : null;
    if (field === 'macd_signal') return coin.macd_signal != null ? Number(coin.macd_signal) : null;
    if (field === 'macd_histogram') return coin.macd_histogram != null ? Number(coin.macd_histogram) : null;
    if (field === 'bb_upper') return coin.bb_upper != null ? Number(coin.bb_upper) : null;
    if (field === 'bb_middle') return coin.bb_middle != null ? Number(coin.bb_middle) : null;
    if (field === 'bb_lower') return coin.bb_lower != null ? Number(coin.bb_lower) : null;
    if (field === 'avg_volume') return coin.avg_volume != null ? Number(coin.avg_volume) : null;
    if (field === 'volatility') return coin.volatility != null ? Number(coin.volatility) : null;
    if (field === 'relative_volume') return coin.relative_volume != null ? Number(coin.relative_volume) : null;

    // Volatility Engine Metrics
    if (field === 'squeeze_on') return coin.squeeze_on === true ? 1 : 0;
    if (field === 'bb_width') return (coin.bb_width ?? coin.raw?.bb_width) != null ? Number(coin.bb_width ?? coin.raw?.bb_width) : null;
    if (field === 'kc_width') return (coin.kc_width ?? coin.raw?.kc_width) != null ? Number(coin.kc_width ?? coin.raw?.kc_width) : null;
    if (field === 'vol_atr') return (coin.vol_atr ?? coin.raw?.vol_atr) != null ? Number(coin.vol_atr ?? coin.raw?.vol_atr) : null;
    if (field === 'vol_stddev') return (coin.vol_stddev ?? coin.raw?.vol_stddev) != null ? Number(coin.vol_stddev ?? coin.raw?.vol_stddev) : null;

    // Candle Body Percentage - body size as % of total range (for candle strength filtering)
    // body = |close - open|, range = high - low, body_pct = (body / range) * 100
    if (field === 'candle_body_pct') {
        const open = Number(coin.open || coin.price || 0);
        const close = Number(coin.close || coin.price || 0);
        const high = Number(coin.high || Math.max(open, close));
        const low = Number(coin.low || Math.min(open, close));
        const body = Math.abs(close - open);
        const range = high - low;
        if (range === 0) return 0;
        return (body / range) * 100;
    }

    // Dynamic Volume Moving Averages - handles volume_ma_XX where XX is any period
    if (field.startsWith('volume_ma_')) {
        const period = parseInt(field.split('_')[2], 10);
        if (!isNaN(period) && period > 0) {
            // Check if pre-calculated, otherwise use avg_volume as fallback
            const maKey = `volume_ma_${period}`;
            if (coin[maKey] != null) return Number(coin[maKey]);
            // For common periods, check specific fields
            if (period === 10 && coin.volume_ma_10 != null) return Number(coin.volume_ma_10);
            if (period === 20 && coin.volume_ma_20 != null) return Number(coin.volume_ma_20);
            if (period === 50 && coin.volume_ma_50 != null) return Number(coin.volume_ma_50);
            // Fallback to avg_volume for other periods
            return coin.avg_volume != null ? Number(coin.avg_volume) : null;
        }
        return null;
    }

    // Previous bar data for breakout detection (1 candle back)
    if (field === 'prev_close') return coin.prev_close != null ? Number(coin.prev_close) : null;
    if (field === 'prev_open') return coin.prev_open != null ? Number(coin.prev_open) : null;
    if (field === 'prev_high') return coin.prev_high != null ? Number(coin.prev_high) : null;
    if (field === 'prev_low') return coin.prev_low != null ? Number(coin.prev_low) : null;
    if (field === 'prev_volume') return coin.prev_volume != null ? Number(coin.prev_volume) : null;

    // 2-candles back data for strong breakout confirmation
    if (field === 'prev_prev_close') return coin.prev_prev_close != null ? Number(coin.prev_prev_close) : null;
    if (field === 'prev_prev_open') return coin.prev_prev_open != null ? Number(coin.prev_prev_open) : null;
    if (field === 'prev_prev_high') return coin.prev_prev_high != null ? Number(coin.prev_prev_high) : null;
    if (field === 'prev_prev_low') return coin.prev_prev_low != null ? Number(coin.prev_prev_low) : null;

    // Previous volatility and RVOL for momentum confirmation
    if (field === 'prev_volatility') return coin.prev_volatility != null ? Number(coin.prev_volatility) : null;
    if (field === 'prev_rvol') return coin.prev_rvol != null ? Number(coin.prev_rvol) : null;

    // Lookback stats for flexible strategy builder
    // Format: max_high_5m, min_low_15m, avg_volume_1h, etc.
    if (field.startsWith('max_high_') || field.startsWith('min_low_') ||
        field.startsWith('max_close_') || field.startsWith('min_close_') ||
        field.startsWith('sum_volume_') || field.startsWith('avg_volume_')) {
        // Map field names like max_high_5m to lookback.maxHigh5m
        const parts = field.split('_');
        const agg = parts[0]; // max, min, sum, avg
        const metric = parts[1]; // high, low, close, volume
        const period = parts[2]; // 5m, 15m, 30m, 1h
        const camelKey = agg + metric.charAt(0).toUpperCase() + metric.slice(1) + period.charAt(0).toUpperCase() + period.slice(1);
        return coin.lookback?.[camelKey] != null ? Number(coin.lookback[camelKey]) : null;
    }

    // ORB (Opening Range Breakout) fields
    // ORB High/Low values for different windows
    if (field === 'orb_high_5m') return (coin.orb_high_5m ?? coin.raw?.orb_high_5m) != null ? Number(coin.orb_high_5m ?? coin.raw?.orb_high_5m) : null;
    if (field === 'orb_low_5m') return (coin.orb_low_5m ?? coin.raw?.orb_low_5m) != null ? Number(coin.orb_low_5m ?? coin.raw?.orb_low_5m) : null;
    if (field === 'orb_high_15m') return (coin.orb_high_15m ?? coin.raw?.orb_high_15m) != null ? Number(coin.orb_high_15m ?? coin.raw?.orb_high_15m) : null;
    if (field === 'orb_low_15m') return (coin.orb_low_15m ?? coin.raw?.orb_low_15m) != null ? Number(coin.orb_low_15m ?? coin.raw?.orb_low_15m) : null;
    if (field === 'orb_high_30m') return (coin.orb_high_30m ?? coin.raw?.orb_high_30m) != null ? Number(coin.orb_high_30m ?? coin.raw?.orb_high_30m) : null;
    if (field === 'orb_low_30m') return (coin.orb_low_30m ?? coin.raw?.orb_low_30m) != null ? Number(coin.orb_low_30m ?? coin.raw?.orb_low_30m) : null;

    // ORB Breakout status: 1 = above (breakout), -1 = below (breakdown), 0 = inside range
    // Check both top-level and raw
    const getOrbStatus = (key) => coin[key] || coin.raw?.[key];

    if (field === 'orb_breakout_5m') {
        const val = getOrbStatus('orb_breakout_5m');
        if (val === 'above') return 1;
        if (val === 'below') return -1;
        return 0;
    }
    if (field === 'orb_breakout_15m') {
        const val = getOrbStatus('orb_breakout_15m');
        if (val === 'above') return 1;
        if (val === 'below') return -1;
        return 0;
    }
    if (field === 'orb_breakout_30m') {
        const val = getOrbStatus('orb_breakout_30m');
        if (val === 'above') return 1;
        if (val === 'below') return -1;
        return 0;
    }

    // OHLC fields - try to get from raw data if available, or top-level props
    if (field === 'open') return Number(coin.open != null ? coin.open : (coin.raw?.open || coin.price || 0));
    if (field === 'high') return Number(coin.high != null ? coin.high : (coin.raw?.high || coin.price || 0));
    if (field === 'low') return Number(coin.low != null ? coin.low : (coin.raw?.low || coin.price || 0));
    if (field === 'close') return Number(coin.close != null ? coin.close : (coin.raw?.close || coin.price || 0));
    if (field === 'rvol') return coin.rvol != null ? Number(coin.rvol) : 0;

    return 0;
};

export const compare = (sourceVal, operator, targetVal) => {
    if (sourceVal == null || targetVal == null) return false;

    switch (operator) {
        case 'above': return sourceVal > targetVal;
        case 'aboveOrEqual': return sourceVal >= targetVal;
        case 'below': return sourceVal < targetVal;
        case 'belowOrEqual': return sourceVal <= targetVal;
        case 'equal': return Math.abs(sourceVal - targetVal) < 0.000001; // Float equality
        // For crosses, we'd need previous state, which we don't have in this simple filter. 
        // Treating as simple comparison for now or false.
        case 'crosses': return false;
        case 'crossesUp': return sourceVal > targetVal; // Approx
        case 'crossesDown': return sourceVal < targetVal; // Approx
        default: return false;
    }
};

export const checkCondition = (coin, cond) => {
    if (!cond) return true;

    // Determine source value based on filter key (passed as cond.field or derived from context if needed)
    // In this utility, we assume 'cond' object might need to carry the 'field' info if it's not passed separately.
    // However, the FilterBuilder structure uses the key in the conditions object as the field.
    // So we'll adapt this function to take (coin, field, cond).
    return true;
};

export const applyFilter = (coins, conditions) => {
    if (!coins || !conditions || Object.keys(conditions).length === 0) return coins;

    return coins.filter(coin => {
        for (const [key, cond] of Object.entries(conditions)) {
            if (!cond) continue;

            // Determine source value based on filter key
            let sourceVal = resolveValue(coin, key);
            if (sourceVal == null) {
                // If indicator value is null, skip this coin (not enough data)
                return false;
            }

            // Handle Range (Min/Max)
            if (cond.min != null && sourceVal < cond.min) return false;
            if (cond.max != null && sourceVal > cond.max) return false;

            // Handle Advanced Operator/Target
            if (cond.operator && cond.target) {
                // If target is 'value', we use min/max which is already handled above
                if (cond.target !== 'value') {
                    let targetVal = resolveValue(coin, cond.target, cond.interval);

                    // Handle dynamic targets like 'avg_volume * 2'
                    if (typeof cond.target === 'string' && cond.target.includes('*')) {
                        const [baseField, multiplier] = cond.target.split('*').map(s => s.trim());
                        const baseVal = resolveValue(coin, baseField);
                        if (baseVal == null) return false;
                        targetVal = baseVal * Number(multiplier || 1);
                    } else if (typeof cond.target === 'string' && cond.target.includes('/')) {
                        const [baseField, divisor] = cond.target.split('/').map(s => s.trim());
                        const baseVal = resolveValue(coin, baseField);
                        if (baseVal == null) return false;
                        targetVal = baseVal / Number(divisor || 1);
                    }

                    if (cond.multiplier) {
                        targetVal = targetVal * Number(cond.multiplier);
                    }

                    if (targetVal == null) return false;
                    if (!compare(sourceVal, cond.operator, targetVal)) return false;
                }
            }

            // Handle dynamic min/max (like 'bb_lower * 1.02') - Legacy string parsing from FilterBuilder
            if (cond.min && typeof cond.min === 'string' && cond.min.includes('*')) {
                const [baseField, multiplier] = cond.min.split('*').map(s => s.trim());
                const baseVal = resolveValue(coin, baseField);
                if (baseVal == null) return false;
                const dynamicMin = baseVal * Number(multiplier || 1);
                if (sourceVal < dynamicMin) return false;
            }
            if (cond.max && typeof cond.max === 'string' && cond.max.includes('*')) {
                const [baseField, multiplier] = cond.max.split('*').map(s => s.trim());
                const baseVal = resolveValue(coin, baseField);
                if (baseVal == null) return false;
                const dynamicMax = baseVal * Number(multiplier || 1);
                if (sourceVal > dynamicMax) return false;
            }
        }
        return true;
    });
};

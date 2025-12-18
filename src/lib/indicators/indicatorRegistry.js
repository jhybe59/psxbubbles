/**
 * Indicator Registry
 * Central registry of all available indicators with their configurations
 */

import {
    calculateSMA,
    calculateEMA,
    calculateWMA,
    calculateHMA,
    calculateVWAP,
    calculateBollingerBands,
    calculateRSI,
    calculateMACD,
    calculateORB,
    calculatePrevDayHL
} from './indicatorCalculations.js';

/**
 * Helper to extract source data from candles
 */
function getSourceData(candles, source) {
    switch (source) {
        case 'open': return candles.map(c => c.open);
        case 'high': return candles.map(c => c.high);
        case 'low': return candles.map(c => c.low);
        case 'hl2': return candles.map(c => (c.high + c.low) / 2);
        case 'hlc3': return candles.map(c => (c.high + c.low + c.close) / 3);
        case 'ohlc4': return candles.map(c => (c.open + c.high + c.low + c.close) / 4);
        case 'close':
        default: return candles.map(c => c.close);
    }
}

const SOURCE_OPTIONS = [
    { value: 'close', label: 'Close' },
    { value: 'open', label: 'Open' },
    { value: 'high', label: 'High' },
    { value: 'low', label: 'Low' },
    { value: 'hl2', label: 'HL2' },
    { value: 'hlc3', label: 'HLC3' },
    { value: 'ohlc4', label: 'OHLC4' }
];

// Indicator categories
export const CATEGORIES = {
    TREND: 'Trend',
    MOMENTUM: 'Momentum',
    VOLATILITY: 'Volatility',
    VOLUME: 'Volume',
    CUSTOM: 'Custom'
};

// Color palette for indicators
export const INDICATOR_COLORS = [
    '#2962FF', // Blue
    '#FF6D00', // Orange
    '#00C853', // Green
    '#AA00FF', // Purple
    '#FF1744', // Red
    '#00B8D4', // Cyan
    '#FFD600', // Yellow
    '#C51162', // Pink
    '#00C853', // Green 5m
    '#CC0000', // Red 5m
    '#009900', // Green 15m
    '#FF0000', // Red 15m
];

/**
 * Get next available color for an indicator
 */
let colorIndex = 0;
export function getNextColor() {
    const color = INDICATOR_COLORS[colorIndex % INDICATOR_COLORS.length];
    colorIndex++;
    return color;
}

export function resetColorIndex() {
    colorIndex = 0;
}

/**
 * Indicator Registry
 * Each indicator has:
 * - id: unique identifier
 * - name: display name
 * - shortName: abbreviated name for header
 * - category: grouping category
 * - type: 'overlay' (on price chart) or 'oscillator' (separate pane)
 * - defaultParams: default parameter values
 * - paramDefs: parameter definitions for settings UI
 * - calculate: function to compute indicator values
 */
export const INDICATOR_REGISTRY = {
    // ===== VOLUME INDICATORS =====
    volume: {
        id: 'volume',
        name: 'Volume',
        shortName: 'Vol',
        category: CATEGORIES.VOLUME,
        type: 'overlay',
        defaultParams: { showMa: true, maLength: 20 },
        paramDefs: [
            { key: 'showMa', label: 'Volume MA', type: 'boolean', default: true },
            { key: 'maLength', label: 'MA Length', type: 'number', min: 1, max: 100, default: 20 }
        ],
        plots: [
            {
                id: 'vol',
                type: 'histogram',
                title: 'Volume',
                priceScaleId: 'volume',
                scaleMargins: { top: 0.8, bottom: 0 }
            },
            {
                id: 'ma',
                type: 'line',
                title: 'Volume MA',
                priceScaleId: 'volume',
                scaleMargins: { top: 0.8, bottom: 0 }
            }
        ],
        calculate: (candles, params) => {
            const volValues = candles.map(c => c.volume);

            // Calculate Volume bars with colors
            // We return objects { value, color }
            const volumeData = candles.map((c, i) => {
                const prev = i > 0 ? candles[i - 1] : null;
                // TradingView logic: Green if close >= prev close (or open?), Red otherwise
                // Actually usually it's Close > Open (Hollow/Filled) or Close > Prev Close.
                // User screens show Green/Red.
                // Standard: Close >= Open = Green (Growing?), Close < Open = Red (Falling?)
                // Or Close > PrevClose?
                // Let's stick to Close >= Open for "Up" candles and Close < Open for "Down" candles matching price.
                const isUp = c.close >= c.open;
                const color = isUp ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)';
                return { value: c.volume, color: color };
            });

            const result = { vol: volumeData };

            if (params.showMa) {
                const ma = calculateSMA(volValues, params.maLength);
                result.ma = ma;
            } else {
                // If hidden, return nulls or empty (generic loop handles nulls)
                result.ma = new Array(candles.length).fill(null);
            }

            return result;
        }
    },

    // ===== TREND INDICATORS =====
    sma: {
        id: 'sma',
        name: 'Simple Moving Average',
        shortName: 'SMA',
        category: CATEGORIES.TREND,
        type: 'overlay',
        defaultParams: { period: 20, source: 'close' },
        paramDefs: [
            { key: 'period', label: 'Period', type: 'number', min: 1, max: 500, step: 1 },
            { key: 'source', label: 'Source', type: 'select', options: SOURCE_OPTIONS }
        ],
        plots: [
            { id: 'main', title: 'Plot', type: 'line' }
        ],
        calculate: (candles, params) => {
            const data = getSourceData(candles, params.source);
            return calculateSMA(data, params.period);
        }
    },

    ema: {
        id: 'ema',
        name: 'Exponential Moving Average',
        shortName: 'EMA',
        category: CATEGORIES.TREND,
        type: 'overlay',
        defaultParams: { period: 9, source: 'close' },
        paramDefs: [
            { key: 'period', label: 'Period', type: 'number', min: 1, max: 500, step: 1 },
            { key: 'source', label: 'Source', type: 'select', options: SOURCE_OPTIONS }
        ],
        plots: [
            { id: 'main', title: 'Plot', type: 'line' }
        ],
        calculate: (candles, params) => {
            const data = getSourceData(candles, params.source);
            return calculateEMA(data, params.period);
        }
    },

    wma: {
        id: 'wma',
        name: 'Weighted Moving Average',
        shortName: 'WMA',
        category: CATEGORIES.TREND,
        type: 'overlay',
        defaultParams: { period: 20, source: 'close' },
        paramDefs: [
            { key: 'period', label: 'Period', type: 'number', min: 1, max: 500, step: 1 },
            { key: 'source', label: 'Source', type: 'select', options: SOURCE_OPTIONS }
        ],
        plots: [
            { id: 'main', title: 'Plot', type: 'line' }
        ],
        calculate: (candles, params) => {
            const data = getSourceData(candles, params.source);
            return calculateWMA(data, params.period);
        }
    },

    hma: {
        id: 'hma',
        name: 'Hull Moving Average',
        shortName: 'HMA',
        category: CATEGORIES.TREND,
        type: 'overlay',
        defaultParams: { period: 9, source: 'close' },
        paramDefs: [
            { key: 'period', label: 'Period', type: 'number', min: 1, max: 500, step: 1 },
            { key: 'source', label: 'Source', type: 'select', options: SOURCE_OPTIONS }
        ],
        plots: [
            { id: 'main', title: 'Plot', type: 'line' }
        ],
        calculate: (candles, params) => {
            const data = getSourceData(candles, params.source);
            return calculateHMA(data, params.period);
        }
    },

    // ===== VOLATILITY INDICATORS =====
    bb: {
        id: 'bb',
        name: 'Bollinger Bands',
        shortName: 'BB',
        category: CATEGORIES.VOLATILITY,
        type: 'overlay',
        multiLine: true, // Has multiple lines
        defaultParams: { period: 20, stdDev: 2, source: 'close' },
        paramDefs: [
            { key: 'period', label: 'Period', type: 'number', min: 1, max: 500, step: 1 },
            { key: 'stdDev', label: 'Std Dev', type: 'number', min: 0.1, max: 5, step: 0.1 },
            { key: 'source', label: 'Source', type: 'select', options: SOURCE_OPTIONS }
        ],
        plots: [
            { id: 'upper', title: 'Upper', type: 'line' },
            { id: 'middle', title: 'Basis', type: 'line' },
            { id: 'lower', title: 'Lower', type: 'line' }
        ],
        calculate: (candles, params) => {
            const data = getSourceData(candles, params.source);
            return calculateBollingerBands(data, params.period, params.stdDev);
        }
    },

    // ===== VOLUME INDICATORS =====
    vwap: {
        id: 'vwap',
        name: 'Volume Weighted Average Price',
        shortName: 'VWAP',
        category: CATEGORIES.VOLUME,
        type: 'overlay',
        defaultParams: {},
        paramDefs: [],
        plots: [
            { id: 'main', title: 'VWAP', type: 'line' }
        ],
        calculate: (candles, params) => {
            return calculateVWAP(candles);
        }
    },

    // ===== MOMENTUM INDICATORS =====
    rsi: {
        id: 'rsi',
        name: 'Relative Strength Index',
        shortName: 'RSI',
        category: CATEGORIES.MOMENTUM,
        type: 'oscillator',
        defaultParams: { period: 14, source: 'close' },
        paramDefs: [
            { key: 'period', label: 'Period', type: 'number', min: 1, max: 100, step: 1 },
            { key: 'source', label: 'Source', type: 'select', options: SOURCE_OPTIONS }
        ],
        plots: [
            { id: 'main', title: 'RSI', type: 'line' }
        ],
        overbought: 70,
        oversold: 30,
        calculate: (candles, params) => {
            const data = getSourceData(candles, params.source);
            return calculateRSI(data, params.period);
        }
    },

    macd: {
        id: 'macd',
        name: 'MACD',
        shortName: 'MACD',
        category: CATEGORIES.MOMENTUM,
        type: 'oscillator',
        multiLine: true,
        defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, source: 'close' },
        paramDefs: [
            { key: 'fastPeriod', label: 'Fast', type: 'number', min: 1, max: 100, step: 1 },
            { key: 'slowPeriod', label: 'Slow', type: 'number', min: 1, max: 100, step: 1 },
            { key: 'signalPeriod', label: 'Signal', type: 'number', min: 1, max: 100, step: 1 },
            { key: 'source', label: 'Source', type: 'select', options: SOURCE_OPTIONS }
        ],
        plots: [
            { id: 'macd', title: 'MACD', type: 'histogram' },
            { id: 'signal', title: 'Signal', type: 'line' },
            { id: 'histogram', title: 'Histogram', type: 'histogram' }
        ],
        calculate: (candles, params) => {
            const data = getSourceData(candles, params.source);
            return calculateMACD(data, params.fastPeriod, params.slowPeriod, params.signalPeriod);
        }
    },

    // ===== CUSTOM INDICATORS =====
    pdh_pdl: {
        id: 'pdh_pdl',
        name: 'Prev Day High/Low',
        shortName: 'PDH/L',
        category: CATEGORIES.CUSTOM,
        type: 'overlay',
        multiLine: true,
        defaultParams: {
            utcOffset: 0,
            showSeparators: true
        },
        paramDefs: [
            { key: 'utcOffset', label: 'UTC Offset', type: 'number', min: -12, max: 12, step: 1 },
            { key: 'showSeparators', label: 'Show Separators', type: 'boolean' }
        ],
        plots: [
            { id: 'pdh', title: 'Prev Day High', type: 'line', color: '#94a3b8' },
            { id: 'pdl', title: 'Prev Day Low', type: 'line', color: '#94a3b8' }
        ],
        calculate: calculatePrevDayHL
    },

    orb: {
        id: 'orb',
        name: 'ORB Merged (5/15/30)',
        shortName: 'ORB',
        category: CATEGORIES.CUSTOM,
        type: 'overlay',
        multiLine: true,
        defaultParams: {
            up5on: true, down5on: true,
            up15on: true, down15on: true,
            up30on: true, down30on: true
        },
        paramDefs: [
            { key: 'up5on', label: '5m High', type: 'boolean', default: true },
            { key: 'down5on', label: '5m Low', type: 'boolean', default: true },
            { key: 'up15on', label: '15m High', type: 'boolean', default: true },
            { key: 'down15on', label: '15m Low', type: 'boolean', default: true },
            { key: 'up30on', label: '30m High', type: 'boolean', default: true },
            { key: 'down30on', label: '30m Low', type: 'boolean', default: true }
        ],
        plots: [
            // 5 Minute
            { id: 'up5', title: '5m High', type: 'line' },
            { id: 'down5', title: '5m Low', type: 'line' },
            // 15 Minute
            { id: 'up15', title: '15m High', type: 'line' },
            { id: 'down15', title: '15m Low', type: 'line' },
            // 30 Minute
            { id: 'up30', title: '30m High', type: 'line' },
            { id: 'down30', title: '30m Low', type: 'line' }
        ],
        calculate: (candles, params) => {
            const results = calculateORB(candles, [5, 15, 30]);

            // Apply visibility filters (return null if disabled)
            if (!params.up5on) results.up5 = results.up5.map(() => null);
            if (!params.down5on) results.down5 = results.down5.map(() => null);
            if (!params.up15on) results.up15 = results.up15.map(() => null);
            if (!params.down15on) results.down15 = results.down15.map(() => null);
            if (!params.up30on) results.up30 = results.up30.map(() => null);
            if (!params.down30on) results.down30 = results.down30.map(() => null);

            return results;
        }
    }
};

/**
 * Get indicator definition by ID
 */
export function getIndicator(id) {
    return INDICATOR_REGISTRY[id] || null;
}

/**
 * Get all indicators grouped by category
 */
export function getIndicatorsByCategory() {
    const grouped = {};
    for (const [id, indicator] of Object.entries(INDICATOR_REGISTRY)) {
        const cat = indicator.category;
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(indicator);
    }
    return grouped;
}

/**
 * Create an indicator instance with unique ID and params
 */
export function createIndicatorInstance(indicatorId, customParams = {}) {
    const def = getIndicator(indicatorId);
    if (!def) return null;

    return {
        instanceId: `${indicatorId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        indicatorId: def.id,
        name: def.name,
        shortName: def.shortName,
        type: def.type,
        params: { ...def.defaultParams, ...customParams },
        // Initialize styles for each plot
        styles: (def.plots || []).reduce((acc, plot) => {
            // Special color override for ORB to match user script
            let defaultColor = getNextColor();
            if (def.id === 'orb') {
                if (plot.id === 'up5') defaultColor = '#00cc00';
                if (plot.id === 'down5') defaultColor = '#cc0000';
                if (plot.id === 'up15') defaultColor = '#009900';
                if (plot.id === 'down15') defaultColor = '#ff0000';
                if (plot.id === 'up30') defaultColor = '#006600';
                if (plot.id === 'down30') defaultColor = '#cc0000';
            }

            acc[plot.id] = {
                color: defaultColor, // Assign unique colors if possible, or cycle
                lineWidth: 2,
                lineStyle: 0, // 0=Solid, 1=Dashed, 2=Dotted
                lineType: 0, // 0=Simple, 1=Step, 2=Curved
                visible: true
            };
            return acc;
        }, {}),
        color: getNextColor(), // Legacy fallback
        visible: true
    };
}

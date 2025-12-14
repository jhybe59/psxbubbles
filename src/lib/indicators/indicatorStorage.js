/**
 * Indicator Storage
 * Persistence layer for saving/loading active indicators per layout
 */

const STORAGE_KEY = 'chart_indicators_layout';

/**
 * Get active indicators for a layout
 * @param {string} layoutId - Layout identifier (default: 'default')
 * @returns {Object[]} - Array of indicator instances
 */
export function getActiveIndicators(layoutId = 'default') {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];

        const layouts = JSON.parse(stored);
        return layouts[layoutId] || [];
    } catch (e) {
        console.error('Failed to load indicators from storage:', e);
        return [];
    }
}

/**
 * Save active indicators for a layout
 * @param {string} layoutId - Layout identifier
 * @param {Object[]} indicators - Array of indicator instances
 */
export function setActiveIndicators(layoutId = 'default', indicators) {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const layouts = stored ? JSON.parse(stored) : {};

        layouts[layoutId] = indicators;

        localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
    } catch (e) {
        console.error('Failed to save indicators to storage:', e);
    }
}

/**
 * Add an indicator to a layout
 * @param {string} layoutId - Layout identifier
 * @param {Object} indicator - Indicator instance to add
 */
export function addIndicator(layoutId = 'default', indicator) {
    const indicators = getActiveIndicators(layoutId);
    indicators.push(indicator);
    setActiveIndicators(layoutId, indicators);
    return indicators;
}

/**
 * Remove an indicator from a layout
 * @param {string} layoutId - Layout identifier
 * @param {string} instanceId - Instance ID of indicator to remove
 */
export function removeIndicator(layoutId = 'default', instanceId) {
    const indicators = getActiveIndicators(layoutId);
    const filtered = indicators.filter(ind => ind.instanceId !== instanceId);
    setActiveIndicators(layoutId, filtered);
    return filtered;
}

/**
 * Update an indicator's properties
 * @param {string} layoutId - Layout identifier
 * @param {string} instanceId - Instance ID of indicator to update
 * @param {Object} updates - Properties to update
 */
export function updateIndicator(layoutId = 'default', instanceId, updates) {
    const indicators = getActiveIndicators(layoutId);
    const updated = indicators.map(ind => {
        if (ind.instanceId === instanceId) {
            return { ...ind, ...updates };
        }
        return ind;
    });
    setActiveIndicators(layoutId, updated);
    return updated;
}

/**
 * Toggle indicator visibility
 * @param {string} layoutId - Layout identifier
 * @param {string} instanceId - Instance ID of indicator
 */
export function toggleIndicatorVisibility(layoutId = 'default', instanceId) {
    const indicators = getActiveIndicators(layoutId);
    const updated = indicators.map(ind => {
        if (ind.instanceId === instanceId) {
            return { ...ind, visible: !ind.visible };
        }
        return ind;
    });
    setActiveIndicators(layoutId, updated);
    return updated;
}

/**
 * Clear all indicators for a layout
 * @param {string} layoutId - Layout identifier
 */
export function clearIndicators(layoutId = 'default') {
    setActiveIndicators(layoutId, []);
    return [];
}

/**
 * Get all layout IDs
 */
export function getLayoutIds() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return ['default'];

        const layouts = JSON.parse(stored);
        return Object.keys(layouts);
    } catch (e) {
        return ['default'];
    }
}

// ============ Candle Type Storage ============
const CANDLE_TYPE_KEY = 'chart_candle_type';

/**
 * Get saved candle type
 * @returns {string} - 'Candles' or 'Heikin-Ashi'
 */
export function getCandleType() {
    try {
        return localStorage.getItem(CANDLE_TYPE_KEY) || 'Candles';
    } catch (e) {
        return 'Candles';
    }
}

/**
 * Save candle type preference
 * @param {string} type - 'Candles' or 'Heikin-Ashi'
 */
export function setCandleType(type) {
    try {
        localStorage.setItem(CANDLE_TYPE_KEY, type);
    } catch (e) {
        console.error('Failed to save candle type:', e);
    }
}

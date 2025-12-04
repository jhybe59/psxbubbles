import * as TI from 'technicalindicators';

/**
 * Calculate RSI (Relative Strength Index) for a symbol
 * @param {Array} priceData - Array of {close, high, low, open, volume}
 * @param {number} period - RSI period (default: 14)
 * @returns {Array} RSI values
 */
export async function calculateRSI(priceData, period = 14) {
  if (!priceData || priceData.length < period + 1) return [];
  const closes = priceData.map(d => Number(d.close || d.price || 0)).filter(v => v > 0);
  if (closes.length < period + 1) return [];
  try {
    return TI.RSI.calculate({ values: closes, period });
  } catch (error) {
    console.warn('[calculateRSI] Error:', error);
    return [];
  }
}

/**
 * Calculate SMA (Simple Moving Average)
 * @param {Array} priceData - Array of price data
 * @param {number} period - SMA period (default: 20)
 * @returns {Array} SMA values
 */
export async function calculateSMA(priceData, period = 20) {
  if (!priceData || priceData.length < period) return [];
  const closes = priceData.map(d => Number(d.close || d.price || 0)).filter(v => v > 0);
  if (closes.length < period) return [];
  try {
    return TI.SMA.calculate({ values: closes, period });
  } catch (error) {
    console.warn('[calculateSMA] Error:', error);
    return [];
  }
}

/**
 * Calculate EMA (Exponential Moving Average)
 * @param {Array} priceData - Array of price data
 * @param {number} period - EMA period (default: 20)
 * @returns {Array} EMA values
 */
export async function calculateEMA(priceData, period = 20) {
  if (!priceData || priceData.length < period) return [];
  const closes = priceData.map(d => Number(d.close || d.price || 0)).filter(v => v > 0);
  if (closes.length < period) return [];
  try {
    return TI.EMA.calculate({ values: closes, period });
  } catch (error) {
    console.warn('[calculateEMA] Error:', error);
    return [];
  }
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param {Array} priceData - Array of price data
 * @param {number} fastPeriod - Fast EMA period (default: 12)
 * @param {number} slowPeriod - Slow EMA period (default: 26)
 * @param {number} signalPeriod - Signal line period (default: 9)
 * @returns {Array} MACD values with {MACD, signal, histogram}
 */
export async function calculateMACD(priceData, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!priceData || priceData.length < slowPeriod + signalPeriod) return [];
  const closes = priceData.map(d => Number(d.close || d.price || 0)).filter(v => v > 0);
  if (closes.length < slowPeriod + signalPeriod) return [];
  try {
    return TI.MACD.calculate({
      values: closes,
      fastPeriod,
      slowPeriod,
      signalPeriod
    });
  } catch (error) {
    console.warn('[calculateMACD] Error:', error);
    return [];
  }
}

/**
 * Calculate Bollinger Bands
 * @param {Array} priceData - Array of price data
 * @param {number} period - Period (default: 20)
 * @param {number} stdDev - Standard deviation (default: 2)
 * @returns {Object} {upper, middle, lower} arrays
 */
export async function calculateBollingerBands(priceData, period = 20, stdDev = 2) {
  if (!priceData || priceData.length < period) return { upper: [], middle: [], lower: [] };
  const closes = priceData.map(d => Number(d.close || d.price || 0)).filter(v => v > 0);
  if (closes.length < period) return { upper: [], middle: [], lower: [] };
  try {
    const result = TI.BollingerBands.calculate({
      values: closes,
      period,
      stdDev
    });
    return {
      upper: result.map(r => r.upper),
      middle: result.map(r => r.middle),
      lower: result.map(r => r.lower)
    };
  } catch (error) {
    console.warn('[calculateBollingerBands] Error:', error);
    return { upper: [], middle: [], lower: [] };
  }
}

/**
 * Calculate Average Volume
 * @param {Array} priceData - Array of price data
 * @param {number} period - Period (default: 20)
 * @returns {number} Average volume
 */
export async function calculateAverageVolume(priceData, period = 20) {
  if (!priceData || priceData.length < period) return 0;
  const volumes = priceData
    .slice(-period)
    .map(d => Number(d.volume || 0))
    .filter(v => v >= 0);
  if (volumes.length === 0) return 0;
  const sum = volumes.reduce((a, b) => a + b, 0);
  return sum / volumes.length;
}

/**
 * Get latest indicator value from array
 * @param {Array} indicatorArray - Array of indicator values
 * @returns {number|null} Latest value or null
 */
export function getLatestIndicatorValue(indicatorArray) {
  if (!indicatorArray || indicatorArray.length === 0) return null;
  const last = indicatorArray[indicatorArray.length - 1];
  if (typeof last === 'object' && last !== null) {
    // For MACD, return the MACD value
    return last.MACD || last.macd || last.value || null;
  }
  return typeof last === 'number' ? last : null;
}

/**
 * Get latest MACD values
 * @param {Array} macdArray - MACD array
 * @returns {Object} {macd, signal, histogram} or null
 */
export function getLatestMACD(macdArray) {
  if (!macdArray || macdArray.length === 0) return null;
  const last = macdArray[macdArray.length - 1];
  return {
    macd: last.MACD || null,
    signal: last.signal || null,
    histogram: last.histogram || null
  };
}

/**
 * Calculate all indicators for a coin
 * @param {Array} priceData - Historical price data
 * @returns {Object} All calculated indicators
 */
export async function calculateAllIndicators(priceData) {
  if (!priceData || priceData.length < 50) {
    return {
      rsi: null,
      sma_20: null,
      sma_50: null,
      sma_200: null,
      ema_20: null,
      macd: null,
      macd_signal: null,
      macd_histogram: null,
      bb_upper: null,
      bb_middle: null,
      bb_lower: null,
      avg_volume: null
    };
  }

  try {
    const [rsi, sma20, sma50, sma200, ema20, macd, bb, avgVolume] = await Promise.all([
      calculateRSI(priceData, 14),
      calculateSMA(priceData, 20),
      calculateSMA(priceData, 50),
      calculateSMA(priceData, 200),
      calculateEMA(priceData, 20),
      calculateMACD(priceData),
      calculateBollingerBands(priceData, 20, 2),
      calculateAverageVolume(priceData, 20)
    ]);

    const latestMACD = getLatestMACD(macd);

    return {
      rsi: getLatestIndicatorValue(rsi),
      sma_20: getLatestIndicatorValue(sma20),
      sma_50: getLatestIndicatorValue(sma50),
      sma_200: getLatestIndicatorValue(sma200),
      ema_20: getLatestIndicatorValue(ema20),
      macd: latestMACD?.macd || null,
      macd_signal: latestMACD?.signal || null,
      macd_histogram: latestMACD?.histogram || null,
      bb_upper: getLatestIndicatorValue(bb.upper),
      bb_middle: getLatestIndicatorValue(bb.middle),
      bb_lower: getLatestIndicatorValue(bb.lower),
      avg_volume: avgVolume
    };
  } catch (error) {
    console.warn('[calculateAllIndicators] Error:', error);
    return {
      rsi: null,
      sma_20: null,
      sma_50: null,
      sma_200: null,
      ema_20: null,
      macd: null,
      macd_signal: null,
      macd_histogram: null,
      bb_upper: null,
      bb_middle: null,
      bb_lower: null,
      avg_volume: null
    };
  }
}


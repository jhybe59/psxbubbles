import { useState, useEffect, useMemo, useRef } from 'react';
import storage from '../lib/storage';
import { calculateAllIndicators } from '../utils/technicalIndicators';

/**
 * Hook to enrich coins with technical indicators
 * Fetches historical data and calculates indicators for each coin
 */
export function useTechnicalIndicators(coins, interval = 'Day', enabled = true) {
  const [enrichedCoins, setEnrichedCoins] = useState([]);
  const [loading, setLoading] = useState(false);
  const indicatorsCacheRef = useRef(new Map());

  // Convert interval to milliseconds for historical data lookup
  const intervalToMs = (interval) => {
    switch (interval) {
      case '1 Min': return 60 * 1000;
      case '5 Min': return 5 * 60 * 1000;
      case '15 Min': return 15 * 60 * 1000;
      case 'Hour': return 60 * 60 * 1000;
      case 'Day': return 24 * 60 * 60 * 1000;
      case 'Week': return 7 * 24 * 60 * 60 * 1000;
      case 'Month': return 30 * 24 * 60 * 60 * 1000;
      case 'Year': return 365 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  };

  useEffect(() => {
    if (!enabled) {
      setEnrichedCoins(coins || []);
      setLoading(false);
      return;
    }
    
    if (!coins || coins.length === 0) {
      setEnrichedCoins([]);
      setLoading(false);
      return;
    }

    async function enrichCoins() {
      try {
        setLoading(true);
        const enriched = [];

        for (const coin of coins) {
        try {
          // Check cache first
          const cacheEntry = indicatorsCacheRef.current.get(`${coin.symbol}-${interval}`);
          if (cacheEntry && Date.now() - cacheEntry.timestamp < 60000) {
            // Use cached data if less than 1 minute old
            enriched.push({ ...coin, ...cacheEntry.indicators });
            continue;
          }

          // Get latest timestamp for this coin
          const latestTs = coin.ts || Date.now();
          
          // Fetch historical data - get last 200 candles for indicators
          // We need at least 200 candles for SMA(200) and other indicators
          const lookbackMs = intervalToMs(interval) * 250; // Get 250 periods
          const fromTs = latestTs - lookbackMs;
          const toTs = latestTs;

          // Try to get historical data from storage
          let historicalData = [];
          try {
            const rangeData = await storage.getRange(coin.symbol, fromTs, toTs);
            if (rangeData && rangeData.length > 0) {
              // Sort by timestamp and convert to format needed for indicators
              historicalData = rangeData
                .sort((a, b) => a.ts - b.ts)
                .map(snap => ({
                  open: snap.raw?.open || snap.price || 0,
                  high: snap.raw?.high || snap.price || 0,
                  low: snap.raw?.low || snap.price || 0,
                  close: snap.price || snap.raw?.close || 0,
                  volume: snap.volume || snap.raw?.volume || 0,
                  ts: snap.ts
                }));
            }
          } catch (err) {
            console.warn(`[useTechnicalIndicators] Failed to fetch historical data for ${coin.symbol}:`, err);
          }

          // If we don't have enough historical data, try to use current coin data
          // and create a minimal dataset (not ideal but better than nothing)
          if (historicalData.length < 50) {
            // Use current coin data as the latest point
            const currentData = {
              open: coin.raw?.open || coin.price || 0,
              high: coin.raw?.high || coin.price || 0,
              low: coin.raw?.low || coin.price || 0,
              close: coin.price || coin.raw?.close || 0,
              volume: coin.volume || coin.raw?.volume || 0,
              ts: latestTs
            };
            
            // If we have some data, use it; otherwise create a minimal array
            if (historicalData.length > 0) {
              historicalData.push(currentData);
            } else {
              // Create a minimal dataset with current price (not ideal for indicators)
              historicalData = Array(50).fill(null).map(() => ({ ...currentData }));
            }
          }

          // Calculate indicators
          const indicators = await calculateAllIndicators(historicalData);

          // Cache the indicators
          indicatorsCacheRef.current.set(`${coin.symbol}-${interval}`, {
            indicators,
            timestamp: Date.now()
          });

          // Merge indicators with coin data
          enriched.push({
            ...coin,
            ...indicators
          });
        } catch (error) {
          console.warn(`[useTechnicalIndicators] Failed to calculate indicators for ${coin.symbol}:`, error);
          // Return coin without indicators if calculation fails
          enriched.push(coin);
        }
      }

        setEnrichedCoins(enriched);
        setLoading(false);
      } catch (error) {
        console.error('[useTechnicalIndicators] Error enriching coins:', error);
        setEnrichedCoins(coins || []);
        setLoading(false);
      }
    }

    enrichCoins();
  }, [coins, interval, enabled]);

  // If disabled, just return original coins
  if (!enabled) {
    return { enrichedCoins: coins || [], loading: false };
  }

  return { enrichedCoins, loading };
}

/**
 * Get indicator value for a coin
 * Helper function to safely get indicator values
 */
export function getIndicatorValue(coin, indicatorName) {
  if (!coin || !indicatorName) return null;
  return coin[indicatorName] ?? null;
}

/**
 * Check if coin has enough data for indicators
 */
export function hasEnoughData(coin) {
  if (!coin) return false;
  // Check if at least some indicators are available
  return coin.rsi != null || coin.sma_20 != null || coin.macd != null;
}

export default useTechnicalIndicators;


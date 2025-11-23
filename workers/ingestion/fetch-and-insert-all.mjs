/**
 * Fetch all 75 symbols data at specific timestamp and ensure symbols exist in instruments table
 * Endpoint: /api/klines/{symbol}/1m/1763720940000
 * Rate limit: 100 requests/minute = 600ms between requests
 */

import axios from 'axios';
import { loadSymbols } from './symbols.mjs';
import { insertMinuteBars, withClient } from './timescale.mjs';
import { config } from './config.mjs';
import logger from './logger.mjs';

// Allow script to run even if some config vars are missing
process.env.PSX_API_TOKEN = process.env.PSX_API_TOKEN || '';
process.env.PSX_API_BATCH_SIZE = process.env.PSX_API_BATCH_SIZE || '80';

/**
 * Sleep function for rate limiting
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Get timestamp: 21 November 2025 15:29:00 PKT = 2025-11-21T10:29:00Z UTC
 */
const getTimestamp = () => {
  const date = new Date('2025-11-21T10:29:00Z');
  return date.getTime();
};

/**
 * Ensure all symbols exist in instruments table
 */
const ensureSymbolsExist = async (symbols) => {
  try {
    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        for (const symbol of symbols) {
          await client.query(
            `INSERT INTO instruments (symbol, name, active)
             VALUES ($1, $2, true)
             ON CONFLICT (symbol) DO UPDATE SET active = true`,
            [symbol, symbol]
          );
        }
        await client.query('COMMIT');
        console.log(`✅ Ensured all ${symbols.length} symbols exist in instruments table\n`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });
  } catch (err) {
    logger.error({ err }, 'Failed to ensure symbols exist');
    throw err;
  }
};

/**
 * Fetch single symbol kline data
 */
const fetchKline = async (symbol, timestamp) => {
  const interval = '1m';
  const baseUrl = config.psxApi.baseUrl || 'https://psxterminal.com/api';
  const url = `${baseUrl}/klines/${symbol}/${interval}/${timestamp}`;
  
  try {
    const response = await axios.get(url, {
      timeout: config.psxApi.timeoutMs || 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Handle response: { success: true, data: {...}, timestamp: ... }
    const responseData = response?.data;
    
    if (!responseData || !responseData.success) {
      logger.warn({ symbol, timestamp, responseData }, 'API returned unsuccessful response');
      return null;
    }

    const candleData = responseData.data;
    if (!candleData) {
      logger.warn({ symbol, timestamp }, 'No data in response');
      return null;
    }

    // Store ALL raw data first
    const rawData = {
      success: responseData.success,
      data: candleData,
      timestamp: responseData.timestamp,
      rawResponse: responseData
    };

    // Extract all available fields from candleData
    const symbol = candleData.symbol || symbol;
    const ts = candleData.timestamp || timestamp;
    const open = Number(candleData.open ?? 0);
    const high = Number(candleData.high ?? 0);
    const low = Number(candleData.low ?? 0);
    const close = Number(candleData.close ?? 0);
    const volume = Number(candleData.volume ?? 0);
    const turnover = candleData.turnover != null ? Number(candleData.turnover) : null;
    
    // Calculate daily percentage change (close vs open for this candle)
    let dailyPct = null;
    if (open && close && open !== 0) {
      dailyPct = ((close - open) / open) * 100;
    }
    
    // If API provides percentage values, use them
    const intervalPct = candleData.intervalPct != null ? Number(candleData.intervalPct) : null;
    const apiDailyPct = candleData.dailyPct != null ? Number(candleData.dailyPct) : null;
    
    // Prefer API-provided dailyPct, otherwise use calculated
    if (apiDailyPct != null) {
      dailyPct = apiDailyPct;
    }

    // Normalize to our format - store ALL raw data
    const row = {
      symbol: symbol,
      ts: ts,
      open: open,
      high: high,
      low: low,
      close: close,
      volume: volume,
      turnover: turnover,
      intervalPct: intervalPct,
      dailyPct: dailyPct,
      raw: rawData // Store complete raw response
    };

    return row;
  } catch (err) {
    const status = err?.response?.status;
    
    if (status === 404) {
      logger.warn({ symbol, timestamp }, 'Kline not found (404)');
      return null;
    }
    
    if (status === 503 || status === 429) {
      logger.warn({ symbol, timestamp, status }, 'Rate limit or service unavailable');
      throw err; // Throw to trigger retry
    }
    
    logger.error({ err, symbol, timestamp, status }, 'Failed to fetch kline');
    return null;
  }
};

/**
 * Fetch all symbols with proper rate limiting
 */
const fetchAllSymbols = async (symbols, timestamp) => {
  const allRows = [];
  const failedSymbols = [];
  const rateLimitMs = 600; // 100 requests/minute = 600ms between requests
  const maxRetries = 2; // Reduced retries to avoid rate limit
  
  console.log(`📊 Fetching ${symbols.length} symbols with rate limit (600ms between requests)\n`);

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    let success = false;
    let retries = 0;

    while (!success && retries < maxRetries) {
      try {
        const row = await fetchKline(symbol, timestamp);
        
        if (row) {
          allRows.push(row);
          console.log(`✅ ${i + 1}/${symbols.length} ${symbol}: C=${row.close} V=${row.volume}`);
          success = true;
        } else {
          // 404 or no data - skip but don't retry
          console.log(`⚠️  ${i + 1}/${symbols.length} ${symbol}: Not found (404)`);
          success = true; // Don't retry 404s
        }
      } catch (err) {
        retries += 1;
        const status = err?.response?.status;
        
        if ((status === 503 || status === 429) && retries < maxRetries) {
          // Rate limit - wait longer and retry
          const waitMs = rateLimitMs * (retries + 1) * 2;
          console.log(`⚠️  ${i + 1}/${symbols.length} ${symbol}: Rate limit (${status}), waiting ${waitMs}ms`);
          await sleep(waitMs);
          continue;
        }
        
        // Other errors or max retries - skip
        console.log(`❌ ${i + 1}/${symbols.length} ${symbol}: Failed after ${retries} retries`);
        failedSymbols.push({ symbol, error: err.message, status });
        success = true; // Move on to next symbol
      }
    }

    // Rate limit: wait 600ms between requests (except after last one)
    if (i < symbols.length - 1) {
      await sleep(rateLimitMs);
    }
  }

  return { allRows, failedSymbols };
};

/**
 * Main function
 */
const fetchAndStore = async () => {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('📊 FETCH DATA FOR 21 NOVEMBER 2025 15:29:00 PKT');
    console.log('='.repeat(70) + '\n');

    // Load symbols
    const symbols = await loadSymbols();
    console.log(`1️⃣  Loaded ${symbols.length} symbols\n`);

    // Ensure all symbols exist in instruments table
    console.log(`2️⃣  Ensuring all symbols exist in instruments table...\n`);
    await ensureSymbolsExist(symbols);

    // Get timestamp
    const timestamp = getTimestamp();
    const timestampDate = new Date(timestamp);
    console.log(`3️⃣  Target Timestamp: ${timestampDate.toISOString()}`);
    console.log(`   Pakistan Time: 2025-11-21 15:29:00 PKT`);
    console.log(`   Timestamp (ms): ${timestamp}\n`);

    // Fetch all symbols with rate limiting
    console.log(`4️⃣  Fetching data for ${symbols.length} symbols...\n`);
    const startTime = Date.now();
    const { allRows, failedSymbols } = await fetchAllSymbols(symbols, timestamp);
    const fetchDuration = Date.now() - startTime;

    console.log(`\n✅ Fetched ${allRows.length} candles in ${(fetchDuration / 1000).toFixed(1)}s\n`);

    if (allRows.length === 0) {
      console.log('❌ No data fetched!');
      return;
    }

    // Prepare for database - preserve ALL fields from raw data
    const normalizedRows = allRows.map(row => {
      // Extract additional fields from raw data if available
      const rawData = row.raw?.data || row.raw || {};
      
      return {
        symbol: row.symbol,
        ts: row.ts,
        open: row.open || 0,
        high: row.high || 0,
        low: row.low || 0,
        close: row.close || 0,
        volume: row.volume || 0,
        value: row.turnover || null,
        daily_pct: row.dailyPct || null, // Use dailyPct if available
        raw: row.raw ? JSON.stringify(row.raw) : JSON.stringify(rawData) // Store complete raw JSON
      };
    });

    console.log(`5️⃣  Storing ${normalizedRows.length} rows in database...\n`);

    // Store in database (deduplication is handled in insertMinuteBars)
    const storeStartTime = Date.now();
    const batchSize = 200;
    let totalInserted = 0;

    for (let i = 0; i < normalizedRows.length; i += batchSize) {
      const batch = normalizedRows.slice(i, i + batchSize);
      const inserted = await insertMinuteBars(batch);
      totalInserted += inserted;
      console.log(`   Batch ${Math.floor(i / batchSize) + 1}: Inserted ${inserted} rows`);
    }

    const storeDuration = Date.now() - storeStartTime;
    console.log(`\n✅ Stored ${totalInserted} rows in ${storeDuration}ms\n`);

    // Summary
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Symbols: ${symbols.length}`);
    console.log(`Fetched: ${allRows.length} candles`);
    console.log(`Stored: ${totalInserted} rows`);
    console.log(`Failed: ${failedSymbols.length} symbols`);
    console.log(`Fetch Duration: ${(fetchDuration / 1000).toFixed(1)}s`);
    console.log(`Store Duration: ${storeDuration}ms`);
    
    if (failedSymbols.length > 0) {
      console.log(`\n⚠️  Failed Symbols (${failedSymbols.length}):`);
      failedSymbols.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.symbol}: ${item.error || item.status}`);
      });
    } else {
      console.log('\n✅ All symbols fetched successfully!');
    }

    console.log('\n' + '='.repeat(70) + '\n');

    return {
      totalSymbols: symbols.length,
      fetched: allRows.length,
      stored: totalInserted,
      failed: failedSymbols.length,
      timestamp
    };

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    throw err;
  }
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAndStore()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Script failed:', err);
      process.exit(1);
    });
}

export default fetchAndStore;


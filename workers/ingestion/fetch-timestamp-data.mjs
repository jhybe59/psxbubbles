/**
 * Fetch data for all 75 symbols at specific timestamp: 21 November 2025 15:29:00 PKT
 * Store in database and make available for bubbles visualization
 */

import { fetchMinuteBars } from './psx-api.mjs';
import { loadSymbols } from './symbols.mjs';
import { insertMinuteBars } from './timescale.mjs';
import { config } from './config.mjs';
import logger from './logger.mjs';

// Allow script to run even if some config vars are missing
process.env.PSX_API_TOKEN = process.env.PSX_API_TOKEN || '';
process.env.PSX_API_BATCH_SIZE = process.env.PSX_API_BATCH_SIZE || '80';

/**
 * Convert Pakistan time to UTC timestamp
 * 21 November 2025 15:29:00 PKT = 2025-11-21T10:29:00Z UTC
 */
const getTimestamp = () => {
  // 21 November 2025 15:29:00 PKT (UTC+5)
  // = 2025-11-21T10:29:00Z UTC
  const date = new Date('2025-11-21T10:29:00Z');
  return date.getTime();
};

/**
 * Fetch and store data for all symbols at specific timestamp
 */
const fetchAndStoreTimestampData = async () => {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('📊 FETCH DATA FOR 21 NOVEMBER 2025 15:29:00 PKT');
    console.log('='.repeat(70) + '\n');

    // Load all symbols
    const symbols = await loadSymbols();
    console.log(`1️⃣  Loaded ${symbols.length} symbols\n`);

    // Get timestamp
    const timestamp = getTimestamp();
    const timestampDate = new Date(timestamp);
    console.log(`2️⃣  Target Timestamp: ${timestampDate.toISOString()}`);
    console.log(`   Pakistan Time: 2025-11-21 15:29:00 PKT`);
    console.log(`   Timestamp (ms): ${timestamp}\n`);

    // Fetch data for all symbols
    console.log(`3️⃣  Fetching data for ${symbols.length} symbols...\n`);
    
    const startTime = Date.now();
    const allRows = await fetchMinuteBars(symbols, timestamp);
    const fetchDuration = Date.now() - startTime;

    console.log(`✅ Fetched ${allRows.length} candles in ${fetchDuration}ms\n`);

    if (allRows.length === 0) {
      console.log('❌ No data fetched! Check API connection and endpoint.');
      return;
    }

    // Normalize and prepare for database
    const normalizedRows = allRows
      .map(row => {
        // Calculate dailyPct if needed
        let dailyPct = row.dailyPct;
        if (dailyPct == null && row.intervalPct != null) {
          dailyPct = row.intervalPct;
        }

        return {
          symbol: row.symbol,
          ts: row.ts,
          open: row.open || 0,
          high: row.high || 0,
          low: row.low || 0,
          close: row.close || 0,
          volume: row.volume || 0,
          value: row.turnover || null,
          daily_pct: dailyPct || null,
          raw: row.raw
        };
      })
      .filter(row => row.symbol && row.ts);

    console.log(`4️⃣  Normalized ${normalizedRows.length} rows\n`);

    // Show sample data
    if (normalizedRows.length > 0) {
      console.log('📋 Sample data (first 5):');
      normalizedRows.slice(0, 5).forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.symbol}: O=${row.open} H=${row.high} L=${row.low} C=${row.close} V=${row.volume}`);
      });
      console.log('');
    }

    // Store in database
    console.log(`5️⃣  Storing in database...\n`);
    
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
    console.log(`Timestamp: ${timestampDate.toISOString()} (2025-11-21 15:29:00 PKT)`);
    console.log(`Fetch Duration: ${fetchDuration}ms`);
    console.log(`Store Duration: ${storeDuration}ms`);
    
    // Check for missing symbols
    const fetchedSymbols = new Set(allRows.map(r => r.symbol));
    const missingSymbols = symbols.filter(s => !fetchedSymbols.has(s));
    
    if (missingSymbols.length > 0) {
      console.log(`\n⚠️  Missing Symbols (${missingSymbols.length}):`);
      missingSymbols.forEach((symbol, index) => {
        console.log(`   ${index + 1}. ${symbol}`);
      });
    } else {
      console.log('\n✅ All symbols fetched successfully!');
    }

    console.log('\n' + '='.repeat(70) + '\n');

    return {
      totalSymbols: symbols.length,
      fetched: allRows.length,
      stored: totalInserted,
      missing: missingSymbols.length,
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
  fetchAndStoreTimestampData()
    .then(() => {
      console.log('✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Script failed:', err);
      process.exit(1);
    });
}

export default fetchAndStoreTimestampData;


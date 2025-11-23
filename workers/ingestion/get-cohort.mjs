/**
 * Get current symbols cohort status
 */

import { loadSymbols } from './symbols.mjs';
import { config } from './config.mjs';

// Allow script to run even if some config vars are missing
process.env.PSX_API_TOKEN = process.env.PSX_API_TOKEN || '';
process.env.PSX_API_BATCH_SIZE = process.env.PSX_API_BATCH_SIZE || '80';

/**
 * Get current minute of day
 */
const getMinuteOfDay = (date = new Date()) => (date.getHours() * 60) + date.getMinutes();

/**
 * Chunk symbols into cohorts
 */
const chunkSymbols = (symbols, size) => {
  if (!Array.isArray(symbols) || !symbols.length) return [];
  const chunkSize = Math.max(1, size || symbols.length || 1);
  const chunks = [];
  for (let i = 0; i < symbols.length; i += chunkSize) {
    chunks.push(symbols.slice(i, i + chunkSize));
  }
  return chunks;
};

/**
 * Get current cohort symbols
 */
const getCurrentCohort = async () => {
  try {
    // Load symbols
    const symbols = await loadSymbols();
    
    const now = new Date();
    const minuteOfDay = getMinuteOfDay(now);
    
    const {
      symbolsPerMinute,
      marketOpenMinute,
      marketCloseMinute,
      symbolFetchDelayMinutes
    } = config.worker;

    const effectiveOpenMinute = Number.isFinite(marketOpenMinute) ? marketOpenMinute : 0;
    const effectiveCloseMinute = Number.isFinite(marketCloseMinute) && marketCloseMinute > effectiveOpenMinute
      ? marketCloseMinute
      : null;
    const startMinute = effectiveOpenMinute + Math.max(0, symbolFetchDelayMinutes || 0);

    // Check if market is open
    const isBeforeMarket = minuteOfDay < startMinute;
    const isAfterMarket = effectiveCloseMinute != null && minuteOfDay > effectiveCloseMinute;
    const isMarketHours = !isBeforeMarket && !isAfterMarket;

    // Create cohorts
    const cohorts = chunkSymbols(symbols, symbolsPerMinute);
    
    // Calculate current cohort index
    let cohortIndex = null;
    let cohortSymbols = [];
    
    if (isMarketHours && cohorts.length > 0) {
      const minutesSinceStart = minuteOfDay - startMinute;
      cohortIndex = minutesSinceStart % cohorts.length;
      cohortSymbols = cohorts[cohortIndex] || [];
    }

    return {
      totalSymbols: symbols.length,
      symbolsPerMinute,
      totalCohorts: cohorts.length,
      currentCohortIndex: cohortIndex,
      currentCohortSymbols: cohortSymbols,
      cohortSize: cohortSymbols.length,
      minuteOfDay,
      startMinute,
      effectiveCloseMinute,
      isBeforeMarket,
      isAfterMarket,
      isMarketHours,
      cohorts: cohorts.map((c, i) => ({
        index: i,
        symbols: c,
        size: c.length
      })),
      allSymbols: symbols
    };
  } catch (err) {
    console.error('Error getting cohort:', err.message);
    throw err;
  }
};

/**
 * Check if symbols are missing or skipped
 */
const checkSymbolsStatus = async (cohortSymbols) => {
  if (!cohortSymbols || cohortSymbols.length === 0) {
    return {
      missing: [],
      skipped: [],
      status: 'no_cohort'
    };
  }

  try {
    const { withClient } = await import('./timescale.mjs');
    
    const status = await withClient(async (client) => {
      // Check which symbols exist in instruments table
      const query = await client.query(`
        SELECT symbol, active
        FROM instruments
        WHERE symbol = ANY($1::text[])
      `, [cohortSymbols]);

      const existingSymbols = query.rows.map(row => row.symbol);
      const missingSymbols = cohortSymbols.filter(s => !existingSymbols.includes(s));
      
      // Check which symbols are inactive
      const inactiveSymbols = query.rows
        .filter(row => !row.active)
        .map(row => row.symbol);

      return {
        total: cohortSymbols.length,
        existing: existingSymbols.length,
        active: existingSymbols.length - inactiveSymbols.length,
        missing: missingSymbols,
        skipped: inactiveSymbols,
        existingSymbols: existingSymbols
      };
    });

    return status;
  } catch (err) {
    console.error('Error checking symbols status:', err.message);
    return {
      missing: cohortSymbols,
      skipped: [],
      status: 'error',
      error: err.message
    };
  }
};

/**
 * Main function
 */
const reportCohort = async () => {
  console.log('\n' + '='.repeat(70));
  console.log('📊 CURRENT SYMBOLS COHORT REPORT');
  console.log('='.repeat(70) + '\n');

  try {
    // 1. Get current cohort
    const cohortInfo = await getCurrentCohort();

    console.log('1️⃣  TOTAL SYMBOLS');
    console.log('-'.repeat(70));
    console.log(`Total Symbols: ${cohortInfo.totalSymbols}`);
    console.log(`Symbols Per Minute: ${cohortInfo.symbolsPerMinute}`);
    console.log(`Total Cohorts: ${cohortInfo.totalCohorts}`);
    console.log(`Current Minute of Day: ${cohortInfo.minuteOfDay}`);
    console.log(`Market Hours: ${cohortInfo.startMinute} - ${cohortInfo.effectiveCloseMinute || 'N/A'}`);
    console.log('');

    // 2. Current cohort symbols
    console.log('2️⃣  CURRENT COHORT SYMBOLS');
    console.log('-'.repeat(70));
    
    if (!cohortInfo.isMarketHours) {
      if (cohortInfo.isBeforeMarket) {
        console.log(`⏰ Market not open yet (opens at minute ${cohortInfo.startMinute})`);
        console.log(`   Current minute: ${cohortInfo.minuteOfDay}`);
        console.log(`   Worker will skip until ${cohortInfo.startMinute}`);
      } else if (cohortInfo.isAfterMarket) {
        console.log(`⏰ Market closed (closed at minute ${cohortInfo.effectiveCloseMinute})`);
        console.log(`   Current minute: ${cohortInfo.minuteOfDay}`);
        console.log(`   Worker will skip until tomorrow`);
      }
      console.log('');
      
      // Calculate what cohort would be active if market was open
      const minutesSinceStart = cohortInfo.minuteOfDay - cohortInfo.startMinute;
      let projectedCohortIndex = null;
      let projectedCohortSymbols = [];
      
      if (minutesSinceStart >= 0 && cohortInfo.cohorts.length > 0) {
        projectedCohortIndex = minutesSinceStart % cohortInfo.totalCohorts;
        projectedCohortSymbols = cohortInfo.cohorts[projectedCohortIndex]?.symbols || [];
      }
      
      if (projectedCohortSymbols.length > 0) {
        console.log(`📋 If market was open, Cohort Index ${projectedCohortIndex} would be active:`);
        projectedCohortSymbols.forEach((symbol, index) => {
          console.log(`   ${(index + 1).toString().padStart(3)}. ${symbol}`);
        });
        console.log('');
      }
      
      console.log(`📋 All ${cohortInfo.totalSymbols} symbols:`);
      cohortInfo.allSymbols.forEach((symbol, index) => {
        console.log(`   ${(index + 1).toString().padStart(3)}. ${symbol}`);
      });
    } else {
      console.log(`Cohort Index: ${cohortInfo.currentCohortIndex}`);
      console.log(`Cohort Size: ${cohortInfo.cohortSize} symbols`);
      console.log(`\nCurrent Cohort Symbols (${cohortInfo.cohortSize}):`);
      cohortInfo.currentCohortSymbols.forEach((symbol, index) => {
        console.log(`   ${(index + 1).toString().padStart(3)}. ${symbol}`);
      });
      console.log('');
    }

    // 3. Check missing/skipped symbols
    console.log('3️⃣  SYMBOLS STATUS CHECK');
    console.log('-'.repeat(70));
    
    if (cohortInfo.isMarketHours && cohortInfo.currentCohortSymbols.length > 0) {
      const symbolsStatus = await checkSymbolsStatus(cohortInfo.currentCohortSymbols);
      
      console.log(`Total in Cohort: ${symbolsStatus.total}`);
      console.log(`Existing in instruments: ${symbolsStatus.existing}`);
      console.log(`Active: ${symbolsStatus.active}`);
      console.log(`Missing: ${symbolsStatus.missing.length}`);
      console.log(`Skipped (inactive): ${symbolsStatus.skipped.length}`);
      console.log('');

      if (symbolsStatus.missing.length > 0) {
        console.log(`❌ MISSING SYMBOLS (${symbolsStatus.missing.length}):`);
        symbolsStatus.missing.forEach((symbol, index) => {
          console.log(`   ${(index + 1).toString().padStart(3)}. ${symbol}`);
        });
        console.log('');
      }

      if (symbolsStatus.skipped.length > 0) {
        console.log(`⚠️  SKIPPED SYMBOLS (Inactive - ${symbolsStatus.skipped.length}):`);
        symbolsStatus.skipped.forEach((symbol, index) => {
          console.log(`   ${(index + 1).toString().padStart(3)}. ${symbol}`);
        });
        console.log('');
      }

      if (symbolsStatus.missing.length === 0 && symbolsStatus.skipped.length === 0) {
        console.log('✅ All symbols exist and active in instruments table');
        console.log('   No missing or skipped symbols');
      } else {
        console.log('⚠️  Issues detected:');
        if (symbolsStatus.missing.length > 0) {
          console.log(`   ❌ ${symbolsStatus.missing.length} symbols missing from instruments table`);
        }
        if (symbolsStatus.skipped.length > 0) {
          console.log(`   ⚠️  ${symbolsStatus.skipped.length} symbols inactive in instruments table`);
        }
      }
    } else {
      console.log('ℹ️  Market is closed - No cohort processing');
      console.log('   Symbols will be processed during market hours');
    }
    console.log('');

    // 4. Summary
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    
    if (!cohortInfo.isMarketHours) {
      console.log('⏰ Market Status: CLOSED');
      console.log('   Worker will process cohorts during market hours');
    } else {
      console.log('✅ Market Status: OPEN');
      console.log(`   Current Cohort: Index ${cohortInfo.currentCohortIndex} (${cohortInfo.cohortSize} symbols)`);
      
      const symbolsStatus = await checkSymbolsStatus(cohortInfo.currentCohortSymbols);
      if (symbolsStatus.missing.length === 0 && symbolsStatus.skipped.length === 0) {
        console.log('✅ All symbols ready for processing');
      } else {
        console.log('⚠️  Issues detected:');
        if (symbolsStatus.missing.length > 0) {
          console.log(`   ❌ ${symbolsStatus.missing.length} symbols missing`);
        }
        if (symbolsStatus.skipped.length > 0) {
          console.log(`   ⚠️  ${symbolsStatus.skipped.length} symbols inactive`);
        }
      }
    }

    console.log('\n' + '='.repeat(70) + '\n');

    return cohortInfo;

  } catch (err) {
    console.error('\n❌ Error generating report:', err.message);
    console.error(err.stack);
    throw err;
  }
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  reportCohort()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed:', err);
      process.exit(1);
    });
}

export default reportCohort;


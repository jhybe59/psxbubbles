/**
 * Quick verification script to check if worker is successfully inserting data
 */

import { withClient } from './timescale.mjs';
import { config } from './config.mjs';

// Allow script to run even if some config vars are missing
process.env.PSX_API_TOKEN = process.env.PSX_API_TOKEN || '';
process.env.PSX_API_BATCH_SIZE = process.env.PSX_API_BATCH_SIZE || '80';

const verifyWorker = async () => {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 WORKER VERIFICATION');
    console.log('='.repeat(60) + '\n');

    // 1. Check recent inserts
    const recentData = await withClient(async (client) => {
      const query = await client.query(`
        SELECT 
          COUNT(*) as total_rows,
          COUNT(DISTINCT symbol) as unique_symbols,
          MAX(ts) as latest_timestamp,
          MIN(ts) as earliest_timestamp
        FROM minute_bars
        WHERE ts >= CURRENT_DATE
      `);

      const latestQuery = await client.query(`
        SELECT 
          symbol,
          ts,
          close,
          volume
        FROM minute_bars
        WHERE ts >= NOW() - INTERVAL '10 minutes'
        ORDER BY ts DESC
        LIMIT 10
      `);

      return {
        today: query.rows[0],
        recent: latestQuery.rows
      };
    });

    console.log('1️⃣  TODAY\'S DATA STATUS');
    console.log('-'.repeat(60));
    console.log(`Total Rows Today: ${recentData.today.total_rows || 0}`);
    console.log(`Unique Symbols: ${recentData.today.unique_symbols || 0}`);
    console.log(`Latest Timestamp: ${recentData.today.latest_timestamp || 'No data'}`);
    console.log(`Earliest Timestamp: ${recentData.today.earliest_timestamp || 'No data'}`);

    if (recentData.today.latest_timestamp) {
      const latest = new Date(recentData.today.latest_timestamp);
      const now = new Date();
      const minutesAgo = Math.floor((now - latest) / 1000 / 60);
      console.log(`⏰ Latest data: ${minutesAgo} minutes ago`);
      
      if (minutesAgo <= 5) {
        console.log('✅ Recent data found - Worker is working!');
      } else {
        console.log(`⚠️  Latest data is ${minutesAgo} minutes old`);
      }
    } else {
      console.log('❌ No data found for today');
    }
    console.log('');

    // 2. Check recent inserts (last 10 minutes)
    console.log('2️⃣  RECENT INSERTS (Last 10 minutes)');
    console.log('-'.repeat(60));
    if (recentData.recent && recentData.recent.length > 0) {
      console.log(`Found ${recentData.recent.length} recent rows:\n`);
      recentData.recent.forEach((row, index) => {
        const ts = new Date(row.ts);
        const timeStr = ts.toISOString().replace('T', ' ').substring(0, 19);
        console.log(`  ${index + 1}. ${row.symbol} | ${timeStr} | C=${row.close} | V=${row.volume}`);
      });
      console.log('\n✅ Data insertion working!');
    } else {
      console.log('⚠️  No recent inserts found (last 10 minutes)');
      console.log('   Worker may not be processing or jobs are being skipped');
    }
    console.log('');

    // 3. Check current cohort symbols
    console.log('3️⃣  CURRENT COHORT SYMBOLS STATUS');
    console.log('-'.repeat(60));
    const currentCohortSymbols = [
      'GATM', 'QUICE', 'SSGC', 'DGKC', 'FFC', 
      'PPL', 'POWER', 'SEARL', 'ATRL', 'FFL',
      'SLGL', 'CEPB', 'SNGP', 'DCL', 'UNITY',
      'ASL', 'MUGHAL', 'FCL', 'TGL', 'MACFL'
    ];

    const cohortStatus = await withClient(async (client) => {
      const query = await client.query(`
        SELECT 
          symbol,
          active,
          CASE 
            WHEN symbol IN (
              SELECT DISTINCT symbol 
              FROM minute_bars 
              WHERE ts >= NOW() - INTERVAL '10 minutes'
            ) THEN true
            ELSE false
          END as has_recent_data
        FROM instruments
        WHERE symbol = ANY($1::text[])
        ORDER BY symbol
      `, [currentCohortSymbols]);

      return query.rows;
    });

    const activeCount = cohortStatus.filter(s => s.active).length;
    const withDataCount = cohortStatus.filter(s => s.has_recent_data).length;

    console.log(`Total Cohort Symbols: ${currentCohortSymbols.length}`);
    console.log(`Active in instruments: ${activeCount}`);
    console.log(`With recent data: ${withDataCount}`);

    if (activeCount === currentCohortSymbols.length) {
      console.log('✅ All symbols active in instruments table');
    } else {
      console.log(`⚠️  ${currentCohortSymbols.length - activeCount} symbols missing or inactive`);
    }

    if (withDataCount > 0) {
      console.log(`✅ ${withDataCount} symbols have recent data`);
    } else {
      console.log('⚠️  No symbols have recent data');
    }
    console.log('');

    // 4. Summary
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    
    const issues = [];
    if (!recentData.today.latest_timestamp) {
      issues.push('❌ No data found for today');
    }
    if (recentData.recent.length === 0) {
      issues.push('⚠️  No recent inserts (last 10 minutes)');
    }
    if (activeCount < currentCohortSymbols.length) {
      issues.push(`⚠️  ${currentCohortSymbols.length - activeCount} symbols missing/inactive`);
    }
    if (withDataCount === 0 && recentData.today.total_rows > 0) {
      issues.push('⚠️  No recent data for current cohort symbols');
    }

    if (issues.length === 0) {
      console.log('✅ All checks passed - Worker is functioning correctly!');
      console.log('   ✓ Data is being inserted');
      console.log('   ✓ Symbols exist in instruments table');
      console.log('   ✓ Recent data found');
    } else {
      console.log('⚠️  Issues detected:');
      issues.forEach(issue => console.log(`   ${issue}`));
    }

    console.log('\n' + '='.repeat(60) + '\n');

  } catch (err) {
    console.error('\n❌ Verification failed:', err.message);
    if (err.code === '23503') {
      console.error('   Foreign key constraint violation detected!');
      console.error('   Ensure all symbols exist in instruments table');
    }
    throw err;
  }
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyWorker()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed:', err);
      process.exit(1);
    });
}

export default verifyWorker;


/**
 * Diagnostic script to check:
 * 1. Current symbols and cohort assignment
 * 2. Database insertion status
 * 3. Connection pool status
 * 4. Last batch insert attempts
 */

import { loadSymbols } from './symbols.mjs';
import { withClient, pool } from './timescale.mjs';
import { config } from './config.mjs';
import logger from './logger.mjs';

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
  const symbols = await loadSymbols();
  const now = new Date();
  const minuteOfDay = getMinuteOfDay(now);
  
  const {
    symbolsPerMinute,
    marketOpenMinute,
    symbolFetchDelayMinutes
  } = config.worker;

  const effectiveOpenMinute = Number.isFinite(marketOpenMinute) ? marketOpenMinute : 0;
  const startMinute = effectiveOpenMinute + Math.max(0, symbolFetchDelayMinutes || 0);

  const cohorts = chunkSymbols(symbols, symbolsPerMinute);
  if (!cohorts.length) {
    return { cohort: null, cohorts: [], minuteOfDay, startMinute };
  }

  const minutesSinceStart = Math.max(0, minuteOfDay - startMinute);
  const cohortIndex = minutesSinceStart % cohorts.length;
  const cohortSymbols = cohorts[cohortIndex] || [];

  return {
    totalSymbols: symbols.length,
    symbolsPerMinute,
    totalCohorts: cohorts.length,
    currentCohortIndex: cohortIndex,
    currentCohortSymbols: cohortSymbols,
    cohortSize: cohortSymbols.length,
    minuteOfDay,
    startMinute,
    cohorts: cohorts.map((c, i) => ({
      index: i,
      symbols: c,
      size: c.length
    }))
  };
};

/**
 * Check database connection pool status
 */
const getPoolStatus = async () => {
  try {
    const stats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      max: pool.options?.max || 10,
      min: pool.options?.min || 0
    };

    // Try to get a connection to test
    const testResult = await withClient(async (client) => {
      const result = await client.query('SELECT NOW() as now, version() as version');
      return {
        connected: true,
        timestamp: result.rows[0].now,
        version: result.rows[0].version.split(' ')[0] // Just PostgreSQL version
      };
    });

    return {
      ...stats,
      ...testResult,
      status: 'healthy'
    };
  } catch (err) {
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      max: pool.options?.max || 10,
      status: 'error',
      error: err.message
    };
  }
};

/**
 * Check last inserted batch
 */
const getLastBatchStatus = async () => {
  try {
    const result = await withClient(async (client) => {
      // Get latest inserted rows
      const latestQuery = await client.query(`
        SELECT 
          symbol,
          ts,
          open,
          high,
          low,
          close,
          volume,
          value,
          daily_pct
        FROM minute_bars
        ORDER BY ts DESC
        LIMIT 20
      `);

      // Get count by symbol for today
      const todayQuery = await client.query(`
        SELECT 
          symbol,
          COUNT(*) as count,
          MIN(ts) as first_ts,
          MAX(ts) as last_ts
        FROM minute_bars
        WHERE ts >= CURRENT_DATE
        GROUP BY symbol
        ORDER BY symbol
      `);

      // Get symbols that should have data today but don't
      const missingQuery = await client.query(`
        SELECT symbol
        FROM instruments
        WHERE symbol IN (SELECT unnest($1::text[]))
          AND symbol NOT IN (
            SELECT DISTINCT symbol 
            FROM minute_bars 
            WHERE ts >= CURRENT_DATE
          )
      `, [config.psxApi.symbolsList || []]);

      return {
        latest: latestQuery.rows,
        todayCounts: todayQuery.rows,
        missingSymbols: missingQuery.rows.map(r => r.symbol)
      };
    });

    return result;
  } catch (err) {
    return {
      error: err.message,
      stack: err.stack
    };
  }
};

/**
 * Test database insertion
 */
const testInsertion = async (testSymbol = 'TEST') => {
  try {
    const testRow = {
      symbol: testSymbol,
      ts: new Date(),
      open: 100.0,
      high: 101.0,
      low: 99.0,
      close: 100.5,
      volume: 1000,
      value: 100500,
      daily_pct: 0.5,
      raw: null
    };

    const { insertMinuteBars } = await import('./timescale.mjs');
    const result = await insertMinuteBars([testRow]);
    
    // Clean up test row
    await withClient(async (client) => {
      await client.query('DELETE FROM minute_bars WHERE symbol = $1', [testSymbol]);
    });

    return {
      success: true,
      inserted: result,
      message: 'Insert test successful'
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      code: err.code,
      constraint: err.constraint,
      detail: err.detail,
      hint: err.hint,
      stack: err.stack
    };
  }
};

/**
 * Check table constraints and structure
 */
const checkTableStructure = async () => {
  try {
    const result = await withClient(async (client) => {
      // Get table constraints
      const constraintsQuery = await client.query(`
        SELECT
          conname as constraint_name,
          contype as constraint_type,
          pg_get_constraintdef(oid) as constraint_definition
        FROM pg_constraint
        WHERE conrelid = 'minute_bars'::regclass
        ORDER BY contype, conname
      `);

      // Get table info
      const tableInfoQuery = await client.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = 'minute_bars'
        ORDER BY ordinal_position
      `);

      // Check if hypertable
      const hypertableQuery = await client.query(`
        SELECT
          hypertable_name,
          num_dimensions,
          compression_enabled
        FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'minute_bars'
      `);

      return {
        constraints: constraintsQuery.rows,
        columns: tableInfoQuery.rows,
        hypertable: hypertableQuery.rows[0] || null
      };
    });

    return result;
  } catch (err) {
    return {
      error: err.message,
      stack: err.stack
    };
  }
};

/**
 * Main diagnostic function
 */
const runDiagnostics = async () => {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 INGESTION WORKER DIAGNOSTICS');
  console.log('='.repeat(70) + '\n');

  try {
    // 1. Current Cohort Status
    console.log('1️⃣  CURRENT COHORT STATUS');
    console.log('-'.repeat(70));
    const cohortStatus = await getCurrentCohort();
    console.log(`Total Symbols: ${cohortStatus.totalSymbols || 0}`);
    console.log(`Symbols Per Minute: ${cohortStatus.symbolsPerMinute || config.worker.symbolsPerMinute}`);
    console.log(`Total Cohorts: ${cohortStatus.totalCohorts || 0}`);
    console.log(`Current Cohort Index: ${cohortStatus.currentCohortIndex ?? 'N/A'}`);
    console.log(`Current Cohort Size: ${cohortStatus.cohortSize || 0}`);
    console.log(`Current Minute of Day: ${cohortStatus.minuteOfDay}`);
    console.log(`Start Minute (after delay): ${cohortStatus.startMinute || 0}`);
    
    if (cohortStatus.currentCohortSymbols && cohortStatus.currentCohortSymbols.length > 0) {
      console.log(`\nCurrent Cohort Symbols (${cohortStatus.cohortSize}):`);
      cohortStatus.currentCohortSymbols.forEach((symbol, idx) => {
        console.log(`  ${idx + 1}. ${symbol}`);
      });
    } else {
      console.log('\n⚠️  No symbols in current cohort (may be outside market hours)');
    }
    console.log('');

    // 2. Connection Pool Status
    console.log('2️⃣  DATABASE CONNECTION POOL STATUS');
    console.log('-'.repeat(70));
    const poolStatus = await getPoolStatus();
    console.log(`Status: ${poolStatus.status || 'unknown'}`);
    console.log(`Active Connections: ${poolStatus.totalCount || 0}`);
    console.log(`Idle Connections: ${poolStatus.idleCount || 0}`);
    console.log(`Waiting Requests: ${poolStatus.waitingCount || 0}`);
    console.log(`Max Connections: ${poolStatus.max || 10}`);
    if (poolStatus.connected) {
      console.log(`✅ Database Connected`);
      console.log(`   Server Time: ${poolStatus.timestamp}`);
      console.log(`   Database Version: ${poolStatus.version || 'N/A'}`);
    } else if (poolStatus.error) {
      console.log(`❌ Database Connection Error: ${poolStatus.error}`);
    }
    console.log('');

    // 3. Table Structure Check
    console.log('3️⃣  TABLE STRUCTURE CHECK');
    console.log('-'.repeat(70));
    const tableStructure = await checkTableStructure();
    if (tableStructure.error) {
      console.log(`❌ Error: ${tableStructure.error}`);
    } else {
      console.log(`Columns: ${tableStructure.columns?.length || 0}`);
      console.log(`Constraints: ${tableStructure.constraints?.length || 0}`);
      if (tableStructure.hypertable) {
        console.log(`✅ Hypertable: Enabled`);
        console.log(`   Dimensions: ${tableStructure.hypertable.num_dimensions}`);
        console.log(`   Compression: ${tableStructure.hypertable.compression_enabled ? 'Enabled' : 'Disabled'}`);
      }
      
      // Show primary key constraint
      const pkConstraint = tableStructure.constraints?.find(c => c.constraint_type === 'p');
      if (pkConstraint) {
        console.log(`Primary Key: ${pkConstraint.constraint_definition}`);
      }
    }
    console.log('');

    // 4. Last Batch Insert Status
    console.log('4️⃣  LAST BATCH INSERT STATUS');
    console.log('-'.repeat(70));
    const lastBatchStatus = await getLastBatchStatus();
    if (lastBatchStatus.error) {
      console.log(`❌ Error: ${lastBatchStatus.error}`);
      if (lastBatchStatus.stack) {
        console.log(`Stack: ${lastBatchStatus.stack}`);
      }
    } else {
      console.log(`Latest Rows: ${lastBatchStatus.latest?.length || 0}`);
      if (lastBatchStatus.latest && lastBatchStatus.latest.length > 0) {
        const latest = lastBatchStatus.latest[0];
        console.log(`Last Inserted: ${latest.ts} - ${latest.symbol} @ ${latest.close}`);
      } else {
        console.log(`⚠️  No data found in minute_bars table`);
      }
      
      console.log(`\nToday's Data (by symbol):`);
      if (lastBatchStatus.todayCounts && lastBatchStatus.todayCounts.length > 0) {
        lastBatchStatus.todayCounts.slice(0, 10).forEach(row => {
          console.log(`  ${row.symbol}: ${row.count} rows (${row.first_ts} to ${row.last_ts})`);
        });
        if (lastBatchStatus.todayCounts.length > 10) {
          console.log(`  ... and ${lastBatchStatus.todayCounts.length - 10} more`);
        }
      } else {
        console.log(`  ⚠️  No data for today`);
      }

      if (lastBatchStatus.missingSymbols && lastBatchStatus.missingSymbols.length > 0) {
        console.log(`\n⚠️  Symbols Missing Today's Data (${lastBatchStatus.missingSymbols.length}):`);
        lastBatchStatus.missingSymbols.slice(0, 10).forEach(symbol => {
          console.log(`  - ${symbol}`);
        });
        if (lastBatchStatus.missingSymbols.length > 10) {
          console.log(`  ... and ${lastBatchStatus.missingSymbols.length - 10} more`);
        }
      }
    }
    console.log('');

    // 5. Test Insertion
    console.log('5️⃣  TEST INSERTION');
    console.log('-'.repeat(70));
    const insertTest = await testInsertion();
    if (insertTest.success) {
      console.log(`✅ Insert Test: SUCCESS`);
      console.log(`   Inserted: ${insertTest.inserted} row(s)`);
    } else {
      console.log(`❌ Insert Test: FAILED`);
      console.log(`   Error: ${insertTest.error}`);
      console.log(`   Code: ${insertTest.code || 'N/A'}`);
      console.log(`   Constraint: ${insertTest.constraint || 'N/A'}`);
      if (insertTest.detail) console.log(`   Detail: ${insertTest.detail}`);
      if (insertTest.hint) console.log(`   Hint: ${insertTest.hint}`);
    }
    console.log('');

    // 6. Summary
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    
    const issues = [];
    if (!poolStatus.connected) {
      issues.push('❌ Database connection failed');
    }
    if (!insertTest.success) {
      issues.push('❌ Database insertion test failed');
    }
    if (!lastBatchStatus.latest || lastBatchStatus.latest.length === 0) {
      issues.push('⚠️  No recent data in minute_bars table');
    }
    if (poolStatus.waitingCount > 0) {
      issues.push(`⚠️  ${poolStatus.waitingCount} requests waiting for connection`);
    }
    if (poolStatus.totalCount >= poolStatus.max) {
      issues.push(`⚠️  Connection pool at maximum (${poolStatus.totalCount}/${poolStatus.max})`);
    }

    if (issues.length === 0) {
      console.log('✅ All checks passed - worker should be functioning normally');
    } else {
      console.log('⚠️  Issues detected:');
      issues.forEach(issue => console.log(`   ${issue}`));
    }
    
    console.log('\n' + '='.repeat(70) + '\n');

    return {
      cohortStatus,
      poolStatus,
      tableStructure,
      lastBatchStatus,
      insertTest,
      issues
    };

  } catch (err) {
    console.error('\n❌ Diagnostic failed:', err.message);
    console.error(err.stack);
    throw err;
  }
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDiagnostics()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to run diagnostics:', err);
      process.exit(1);
    });
}

export default runDiagnostics;


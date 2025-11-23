/**
 * Example usage of aggregation utilities
 * 
 * This file demonstrates how to use the aggregates.mjs module
 * to query OHLCV data at different intervals.
 */

import {
  getAggregatedBars,
  getLatestBar,
  getBarsBySymbols,
  getAggregateStatus,
  refreshAggregate,
  isMarketOpen,
  getMarketHours,
  INTERVAL_CONFIGS
} from './aggregates.mjs';

// Example 1: Get latest 5-minute candles for a symbol
async function example1() {
  console.log('\n=== Example 1: Latest 5-minute candles ===');
  
  const candles = await getAggregatedBars('5m', {
    symbols: 'OGDC',
    limit: 10
  });
  
  console.log(`Found ${candles.length} candles:`);
  candles.forEach(candle => {
    console.log(`${candle.ts.toISOString()}: O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close} V=${candle.volume}`);
  });
}

// Example 2: Get hourly candles for date range
async function example2() {
  console.log('\n=== Example 2: Hourly candles for date range ===');
  
  const startTime = new Date('2024-01-01');
  const endTime = new Date('2024-01-07');
  
  const candles = await getAggregatedBars('1h', {
    symbols: ['OGDC', 'PPL'],
    startTime,
    endTime,
    limit: 0  // No limit
  });
  
  console.log(`Found ${candles.length} hourly candles`);
  console.log(`Symbols: ${[...new Set(candles.map(c => c.symbol))].join(', ')}`);
}

// Example 3: Get latest daily candle
async function example3() {
  console.log('\n=== Example 3: Latest daily candle ===');
  
  const latestBar = await getLatestBar('1d', 'OGDC');
  
  if (latestBar) {
    console.log(`Latest daily candle for ${latestBar.symbol}:`);
    console.log(`  Date: ${latestBar.ts.toISOString().split('T')[0]}`);
    console.log(`  Open: ${latestBar.open}`);
    console.log(`  High: ${latestBar.high}`);
    console.log(`  Low: ${latestBar.low}`);
    console.log(`  Close: ${latestBar.close}`);
    console.log(`  Volume: ${latestBar.volume}`);
    console.log(`  Daily % Change: ${latestBar.dailyPct}%`);
    console.log(`  Interval % Change: ${latestBar.intervalPct}%`);
  } else {
    console.log('No data found');
  }
}

// Example 4: Get bars grouped by symbol
async function example4() {
  console.log('\n=== Example 4: Weekly candles grouped by symbol ===');
  
  const startTime = new Date('2024-01-01');
  const endTime = new Date('2024-01-31');
  
  const barsBySymbol = await getBarsBySymbols(
    '1w',
    ['OGDC', 'PPL', 'FFC'],
    startTime,
    endTime
  );
  
  Object.entries(barsBySymbol).forEach(([symbol, candles]) => {
    console.log(`\n${symbol}: ${candles.length} weekly candles`);
    candles.forEach(candle => {
      console.log(`  Week of ${candle.ts.toISOString().split('T')[0]}: C=${candle.close} (${candle.intervalPct}%)`);
    });
  });
}

// Example 5: Check aggregate status
async function example5() {
  console.log('\n=== Example 5: Aggregate status ===');
  
  const status = await getAggregateStatus('5m');
  
  console.log('5-minute aggregate status:');
  console.log(`  View Name: ${status['5m'].viewName}`);
  console.log(`  Description: ${status['5m'].description}`);
  console.log(`  Row Count: ${status['5m'].rowCount.toLocaleString()}`);
  console.log(`  Latest Bucket: ${status['5m'].latestBucket}`);
  console.log(`  Exists: ${status['5m'].exists}`);
}

// Example 6: Market hours check
async function example6() {
  console.log('\n=== Example 6: Market hours ===');
  
  const marketHours = getMarketHours();
  console.log('Market Hours:');
  console.log(`  Timezone: ${marketHours.timezone}`);
  console.log(`  Open: ${marketHours.open}`);
  console.log(`  Close: ${marketHours.close}`);
  console.log(`  Days: ${marketHours.days.join(', ')}`);
  
  const now = new Date();
  console.log(`\nCurrent time: ${now.toISOString()}`);
  console.log(`Market is ${isMarketOpen(now) ? 'OPEN' : 'CLOSED'}`);
  
  // Check for a specific time
  const marketOpenTime = new Date('2024-01-15T09:30:00+05:00');
  console.log(`\nAt ${marketOpenTime.toISOString()}:`);
  console.log(`Market is ${isMarketOpen(marketOpenTime) ? 'OPEN' : 'CLOSED'}`);
}

// Example 7: Get all available intervals
async function example7() {
  console.log('\n=== Example 7: Available intervals ===');
  
  console.log('Supported intervals:');
  Object.entries(INTERVAL_CONFIGS).forEach(([key, config]) => {
    console.log(`  ${key}: ${config.description} (${config.bucketInterval})`);
  });
}

// Example 8: Manual refresh (use sparingly)
async function example8() {
  console.log('\n=== Example 8: Manual refresh ===');
  
  // Only refresh if needed (e.g., after bulk data import)
  const startTime = new Date('2024-01-15T09:00:00Z');
  const endTime = new Date('2024-01-15T10:00:00Z');
  
  console.log(`Refreshing 5-minute aggregate for ${startTime.toISOString()} to ${endTime.toISOString()}`);
  
  try {
    await refreshAggregate('5m', startTime, endTime);
    console.log('Refresh completed successfully');
  } catch (err) {
    console.error('Refresh failed:', err.message);
  }
}

// Example 9: Real-world use case - Price alert check
async function example9() {
  console.log('\n=== Example 9: Price alert check ===');
  
  if (!isMarketOpen()) {
    console.log('Market is closed, skipping price check');
    return;
  }
  
  const symbol = 'OGDC';
  const alertPrice = 150.0;
  
  const latestBar = await getLatestBar('5m', symbol);
  
  if (latestBar && latestBar.close >= alertPrice) {
    console.log(`🚨 ALERT: ${symbol} closed at ${latestBar.close}, above alert price ${alertPrice}`);
    console.log(`  5m candle: ${latestBar.ts.toISOString()}`);
    console.log(`  Daily change: ${latestBar.dailyPct}%`);
  } else {
    console.log(`${symbol} is trading below alert price ${alertPrice}`);
  }
}

// Example 10: Compare intervals
async function example10() {
  console.log('\n=== Example 10: Compare intervals ===');
  
  const symbol = 'OGDC';
  const intervals = ['5m', '15m', '1h', '1d'];
  
  console.log(`Latest candles for ${symbol} across intervals:`);
  
  for (const interval of intervals) {
    const latestBar = await getLatestBar(interval, symbol);
    if (latestBar) {
      console.log(`  ${interval.padEnd(3)}: ${latestBar.ts.toISOString()} | C=${latestBar.close.toFixed(2)} | V=${latestBar.volume.toLocaleString()}`);
    }
  }
}

// Run examples
async function runExamples() {
  try {
    await example1();
    await example2();
    await example3();
    await example4();
    await example5();
    await example6();
    await example7();
    // await example8(); // Uncomment if manual refresh needed
    await example9();
    await example10();
    
    console.log('\n✅ All examples completed!');
  } catch (err) {
    console.error('Error running examples:', err);
  } finally {
    // Close database pool
    const { closePool } = await import('./aggregates.mjs');
    await closePool();
    process.exit(0);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}


# OHLCV Aggregation Guide - 1-minute to 1-year Intervals

## Overview

This guide explains how 1-minute OHLCV candle data is automatically aggregated into higher timeframes (5m, 15m, 1h, 4h, 1d, 1w, 1M, 1Y) using **TimescaleDB Continuous Aggregates**.

## Architecture Decision: TimescaleDB Continuous Aggregates vs Worker-based

### ✅ Recommended: TimescaleDB Continuous Aggregates

**Advantages:**
- **Automatic**: Aggregates refresh automatically based on policies
- **Efficient**: Incremental updates, only processes new data
- **Fast Queries**: Pre-computed materialized views
- **Low Overhead**: Database handles aggregation, no application code needed
- **Reliable**: Built into TimescaleDB, battle-tested
- **Storage Optimized**: Automatic compression and retention policies

**How it works:**
1. New 1-minute bars are inserted into `minute_bars` table
2. TimescaleDB automatically detects new data
3. Continuous aggregate policies refresh views incrementally
4. Queries read from pre-computed materialized views

### ❌ Alternative: Worker-based Aggregation

**Disadvantages:**
- Requires custom Node.js worker code
- Must handle race conditions and duplicate prevention
- More complex error handling and retry logic
- Higher application complexity
- Potential for data inconsistencies

**When to use:**
- Only if TimescaleDB continuous aggregates are not available
- For custom aggregation logic that can't be expressed in SQL

## Supported Intervals

| Interval | View Name | Bucket Size | Refresh Frequency | Retention |
|----------|-----------|-------------|-------------------|-----------|
| 5m | `minute_bars_5m` | 5 minutes | Every 1 minute | 365 days |
| 15m | `minute_bars_15m` | 15 minutes | Every 5 minutes | 365 days |
| 1h | `minute_bars_1h` | 1 hour | Every 15 minutes | 730 days |
| 4h | `minute_bars_4h` | 4 hours | Every 1 hour | 730 days |
| 1d | `minute_bars_1d` | 1 day | Every 1 hour | 1460 days (4 years) |
| 1w | `minute_bars_1w` | 1 week | Every 6 hours | 1460 days |
| 1mo | `minute_bars_1mo` | 1 month | Every 1 day | 2920 days (8 years) |
| 1y | `minute_bars_1y` | 1 year | Every 1 week | 3650 days (10 years) |

## Database Schema

### Base Table: `minute_bars`
```sql
CREATE TABLE minute_bars (
    symbol TEXT NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    open NUMERIC(18,6) NOT NULL,
    high NUMERIC(18,6) NOT NULL,
    low NUMERIC(18,6) NOT NULL,
    close NUMERIC(18,6) NOT NULL,
    volume NUMERIC(20,2) NOT NULL DEFAULT 0,
    value NUMERIC(22,2),  -- turnover
    daily_pct NUMERIC(10,4),
    raw JSONB,
    PRIMARY KEY (symbol, ts)
);
```

### Continuous Aggregate Example: `minute_bars_5m`
```sql
CREATE MATERIALIZED VIEW minute_bars_5m
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  time_bucket('5 minutes', ts) AS bucket,
  first(open, ts) AS open,           -- First open price in bucket
  max(high) AS high,                 -- Maximum high in bucket
  min(low) AS low,                   -- Minimum low in bucket
  last(close, ts) AS close,           -- Last close price in bucket
  sum(volume) AS volume_sum,         -- Sum of volumes
  sum(value) AS turnover_sum,        -- Sum of turnover
  last(daily_pct, ts) AS daily_pct,  -- Last daily_pct value
  (last(close, ts) - first(open, ts)) / NULLIF(first(open, ts), 0) * 100 AS pct_change
FROM minute_bars
GROUP BY symbol, bucket;
```

### Aggregation Logic

**OHLCV Calculation:**
- **Open**: `first(open, ts)` - First open price in the time bucket
- **High**: `max(high)` - Maximum high price in the bucket
- **Low**: `min(low)` - Minimum low price in the bucket
- **Close**: `last(close, ts)` - Last close price in the bucket
- **Volume**: `sum(volume)` - Sum of all volumes in the bucket
- **Turnover**: `sum(value)` - Sum of all turnover values
- **Interval % Change**: `(close - open) / open * 100`
- **Daily % Change**: `last(daily_pct, ts)` - Carries forward from source data

## Setup & Migration

### 1. Run Migrations

```bash
# Apply all migrations in order
psql -h timescale -U postgres -d cryptobubbles -f db/migrations/004_continuous_aggregates.sql
psql -h timescale -U postgres -d cryptobubbles -f db/migrations/007_additional_aggregates.sql
psql -h timescale -U postgres -d cryptobubbles -f db/migrations/005_policies.sql
psql -h timescale -U postgres -d cryptobubbles -f db/migrations/009_aggregate_indexes.sql
```

### 2. Verify Setup

```sql
-- Check continuous aggregates exist
SELECT view_name, materialized_only, finalized
FROM timescaledb_information.continuous_aggregates
WHERE view_name LIKE 'minute_bars_%'
ORDER BY view_name;

-- Check refresh policies
SELECT 
  view_name,
  schedule_interval,
  start_offset,
  end_offset
FROM timescaledb_information.jobs
WHERE proc_name = 'policy_refresh_continuous_aggregate'
ORDER BY view_name;

-- Check retention policies
SELECT 
  hypertable_name,
  drop_after
FROM timescaledb_information.jobs
WHERE proc_name = 'policy_retention'
ORDER BY hypertable_name;
```

## Automatic Refresh Mechanism

### How It Works

1. **Ingestion Worker** inserts new 1-minute bars every minute
2. **TimescaleDB** detects new data in `minute_bars` hypertable
3. **Refresh Policies** automatically trigger based on schedule:
   - 5m aggregates: Refresh every 1 minute (last 2 hours)
   - 15m aggregates: Refresh every 5 minutes (last 6 hours)
   - 1h aggregates: Refresh every 15 minutes (last 2 days)
   - 4h aggregates: Refresh every 1 hour (last 7 days)
   - 1d aggregates: Refresh every 1 hour (last 7 days)
   - 1w aggregates: Refresh every 6 hours (last 30 days)
   - 1mo aggregates: Refresh every 1 day (last 90 days)
   - 1y aggregates: Refresh every 1 week (last 2 years)

### Refresh Policy Configuration

```sql
-- Example: 5-minute aggregate policy
SELECT add_continuous_aggregate_policy('minute_bars_5m',
  start_offset => INTERVAL '2 hours',    -- Refresh last 2 hours
  end_offset => INTERVAL '0',             -- Up to current time
  schedule_interval => INTERVAL '1 minute' -- Run every minute
);
```

**Why `end_offset => INTERVAL '0'`?**
- Ensures aggregates include the most recent data
- TimescaleDB handles timezone-aware bucketing automatically

## Node.js Usage

### Import the Module

```javascript
import { 
  getAggregatedBars, 
  getLatestBar, 
  getBarsBySymbols,
  getAggregateStatus,
  isMarketOpen,
  getMarketHours,
  INTERVAL_CONFIGS
} from './workers/ingestion/aggregates.mjs';
```

### Example 1: Get Latest 5-minute Candles

```javascript
// Get latest 100 candles for a symbol
const candles = await getAggregatedBars('5m', {
  symbols: 'OGDC',
  limit: 100
});

console.log(candles);
// [
//   {
//     symbol: 'OGDC',
//     ts: '2024-01-15T10:00:00Z',
//     open: 150.50,
//     high: 151.20,
//     low: 150.30,
//     close: 150.90,
//     volume: 125000,
//     turnover: 18862500,
//     intervalPct: 0.265,
//     dailyPct: 1.2
//   },
//   ...
// ]
```

### Example 2: Get Time Range Data

```javascript
// Get 1-hour candles for last 7 days
const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const endTime = new Date();

const hourlyCandles = await getAggregatedBars('1h', {
  symbols: ['OGDC', 'PPL', 'FFC'],
  startTime,
  endTime,
  limit: 0  // No limit
});
```

### Example 3: Get Latest Bar for Multiple Symbols

```javascript
// Get latest daily candle for multiple symbols
const latestBars = await getLatestBar('1d', ['OGDC', 'PPL', 'FFC']);

latestBars.forEach(bar => {
  console.log(`${bar.symbol}: ${bar.close} (${bar.dailyPct}%)`);
});
```

### Example 4: Get Bars Grouped by Symbol

```javascript
// Get weekly candles for multiple symbols
const startTime = new Date('2024-01-01');
const endTime = new Date('2024-01-31');

const barsBySymbol = await getBarsBySymbols(
  '1w',
  ['OGDC', 'PPL', 'FFC'],
  startTime,
  endTime
);

// Result structure:
// {
//   'OGDC': [/* array of weekly candles */],
//   'PPL': [/* array of weekly candles */],
//   'FFC': [/* array of weekly candles */]
// }
```

### Example 5: Check Aggregate Status

```javascript
// Get status of all aggregates
const status = await getAggregateStatus();

console.log(status);
// {
//   '5m': {
//     viewName: 'minute_bars_5m',
//     description: '5-minute candles',
//     rowCount: 125000,
//     latestBucket: '2024-01-15T10:00:00Z',
//     exists: true
//   },
//   ...
// }

// Check specific interval
const fiveMinStatus = await getAggregateStatus('5m');
```

### Example 6: Manual Refresh (if needed)

```javascript
// Refresh 5-minute aggregate for specific time range
const startTime = new Date('2024-01-15T09:00:00Z');
const endTime = new Date('2024-01-15T10:00:00Z');

await refreshAggregate('5m', startTime, endTime);

// Refresh entire aggregate (use sparingly)
await refreshAggregate('5m');
```

### Example 7: Market Hours Awareness

```javascript
import { isMarketOpen, getMarketHours } from './workers/ingestion/aggregates.mjs';

// Check if market is currently open (PKT timezone)
if (isMarketOpen()) {
  console.log('Market is open');
} else {
  console.log('Market is closed');
}

// Get market hours info
const marketHours = getMarketHours();
console.log(marketHours);
// {
//   timezone: 'Asia/Karachi',
//   open: '09:30',
//   close: '15:30',
//   openMinute: 570,
//   closeMinute: 930,
//   days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
// }

// Query only during market hours
if (isMarketOpen()) {
  const latestBar = await getLatestBar('5m', 'OGDC');
  console.log('Latest price:', latestBar.close);
}
```

## Performance Optimizations

### 1. Indexes

Indexes are automatically created for optimal query performance:

```sql
-- Symbol + time bucket index (most common query pattern)
CREATE INDEX minute_bars_5m_symbol_bucket_idx 
  ON minute_bars_5m (symbol, bucket DESC);

-- Time-only index (for time-range queries)
CREATE INDEX minute_bars_5m_bucket_idx 
  ON minute_bars_5m (bucket DESC);
```

**Query Patterns Optimized:**
- `WHERE symbol = 'OGDC' ORDER BY bucket DESC` → Uses symbol_bucket_idx
- `WHERE bucket BETWEEN ... AND ...` → Uses bucket_idx
- `WHERE symbol = 'OGDC' AND bucket BETWEEN ...` → Uses symbol_bucket_idx

### 2. Compression

Older data is automatically compressed:

```sql
-- Compression policy (already configured)
ALTER TABLE minute_bars SET (timescaledb.compress);
SELECT add_compression_policy('minute_bars', INTERVAL '7 days');
```

**Benefits:**
- Reduces storage by 90%+ for old data
- Queries automatically decompress when needed
- No application code changes required

### 3. Retention Policies

Old data is automatically dropped:

```sql
-- Retention policies (already configured)
SELECT add_retention_policy('minute_bars', INTERVAL '90 days');
SELECT add_retention_policy('minute_bars_5m', INTERVAL '365 days');
```

**Storage Savings:**
- Raw minute bars: 90 days retention
- Aggregates: Longer retention (365 days to 10 years)
- Automatic cleanup, no manual intervention

### 4. Query Optimization Tips

**✅ Good Query Patterns:**
```sql
-- Use symbol filter first
SELECT * FROM minute_bars_5m 
WHERE symbol = 'OGDC' 
ORDER BY bucket DESC LIMIT 100;

-- Use time range with symbol
SELECT * FROM minute_bars_1h
WHERE symbol = 'OGDC' 
  AND bucket >= '2024-01-01' 
  AND bucket <= '2024-01-31';
```

**❌ Avoid:**
```sql
-- Don't scan all symbols without filter
SELECT * FROM minute_bars_5m ORDER BY bucket DESC LIMIT 100;

-- Don't use functions on indexed columns
SELECT * FROM minute_bars_5m 
WHERE EXTRACT(hour FROM bucket) = 10;  -- Bad!
```

## Monitoring & Maintenance

### Check Aggregate Refresh Status

```sql
-- View recent refresh jobs
SELECT 
  view_name,
  last_run_started_at,
  last_successful_finish,
  last_run_status,
  job_status
FROM timescaledb_information.jobs
WHERE proc_name = 'policy_refresh_continuous_aggregate'
ORDER BY last_run_started_at DESC;
```

### Check Data Freshness

```sql
-- Compare latest bucket in aggregate vs source
SELECT 
  'minute_bars' as source,
  MAX(ts) as latest_timestamp
FROM minute_bars
WHERE symbol = 'OGDC'

UNION ALL

SELECT 
  'minute_bars_5m' as source,
  MAX(bucket) as latest_timestamp
FROM minute_bars_5m
WHERE symbol = 'OGDC';
```

### Manual Refresh (if needed)

```sql
-- Refresh specific time range
CALL refresh_continuous_aggregate('minute_bars_5m', 
  '2024-01-15 09:00:00'::timestamptz,
  '2024-01-15 10:00:00'::timestamptz
);

-- Refresh entire view (use sparingly, can be slow)
CALL refresh_continuous_aggregate('minute_bars_5m', NULL, NULL);
```

### Troubleshooting

**Problem: Aggregates not updating**
```sql
-- Check if policies are enabled
SELECT * FROM timescaledb_information.jobs
WHERE proc_name = 'policy_refresh_continuous_aggregate';

-- Check for errors in job logs
SELECT * FROM timescaledb_information.job_stats
WHERE job_id IN (
  SELECT job_id FROM timescaledb_information.jobs
  WHERE proc_name = 'policy_refresh_continuous_aggregate'
);
```

**Problem: Slow queries**
```sql
-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT * FROM minute_bars_5m
WHERE symbol = 'OGDC'
ORDER BY bucket DESC LIMIT 100;

-- Should show: Index Scan using minute_bars_5m_symbol_bucket_idx
```

## Timezone Handling

### Market Hours (Pakistan Stock Exchange)

- **Timezone**: Asia/Karachi (PKT, UTC+5)
- **Trading Hours**: 09:30 - 15:30 PKT (Monday-Friday)
- **Market Closed**: Weekends and public holidays

### TimescaleDB Timezone

TimescaleDB stores all timestamps as `TIMESTAMPTZ` (timezone-aware):
- Data is stored in UTC internally
- Queries automatically handle timezone conversion
- `time_bucket()` respects timezone boundaries

### Example: Query with Timezone

```sql
-- Get daily candles for a specific date in PKT
SELECT * FROM minute_bars_1d
WHERE symbol = 'OGDC'
  AND bucket >= '2024-01-15 00:00:00+05:00'::timestamptz
  AND bucket < '2024-01-16 00:00:00+05:00'::timestamptz;
```

## Complete Example: API Endpoint

```javascript
// server/api/routes/candles.mjs
import express from 'express';
import { getAggregatedBars, getLatestBar } from '../../workers/ingestion/aggregates.mjs';

const router = express.Router();

// GET /api/candles/:symbol/:interval
router.get('/:symbol/:interval', async (req, res) => {
  try {
    const { symbol, interval } = req.params;
    const { start, end, limit = 1000 } = req.query;

    const options = {
      symbols: symbol.toUpperCase(),
      limit: parseInt(limit, 10)
    };

    if (start) options.startTime = new Date(start);
    if (end) options.endTime = new Date(end);

    const candles = await getAggregatedBars(interval, options);
    
    res.json({
      symbol: symbol.toUpperCase(),
      interval,
      count: candles.length,
      candles
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/candles/:symbol/:interval/latest
router.get('/:symbol/:interval/latest', async (req, res) => {
  try {
    const { symbol, interval } = req.params;
    const candle = await getLatestBar(interval, symbol.toUpperCase());
    
    if (!candle) {
      return res.status(404).json({ error: 'No data found' });
    }
    
    res.json(candle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

## Summary

✅ **TimescaleDB Continuous Aggregates** automatically handle:
- Incremental aggregation of 1-minute → higher intervals
- Automatic refresh based on policies
- Efficient storage with compression
- Fast queries with pre-computed views
- Automatic retention and cleanup

✅ **Node.js Utilities** provide:
- Easy querying of aggregated data
- Market hours awareness
- Status monitoring
- Manual refresh capabilities

✅ **Performance Optimizations**:
- Indexes on (symbol, bucket) and (bucket)
- Automatic compression after 7 days
- Retention policies for storage management
- Optimized query patterns

**No worker code needed** - TimescaleDB handles everything automatically! 🎉


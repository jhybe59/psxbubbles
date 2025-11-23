# 🔍 INGESTION WORKER STATUS REPORT

Generated: `date`

## ⚠️ WORKER STATUS - ISSUES DETECTED

### 1. Worker Running Status
**✅ WORKER IS RUNNING** (but experiencing failures)

- **Container Name**: `my-cryptobubbles-worker-1`
- **Container Status**: Up 3+ hours
- **Process**: Node.js worker (`workers/ingestion/index.mjs`)
- **Queue**: BullMQ (`psx-fetch-minute-bars`)
- **Cron Pattern**: `* * * * *` (every minute)
- **⚠️ Issue**: Many database insertion failures detected

### 2. Job Scheduling

**✅ REPEATABLE JOB ACTIVE**

- **Job Name**: `poll-minute-bars`
- **Schedule**: Every minute (cron: `* * * * *`)
- **Status**: Running and processing jobs

### 3. Recent Activity

**Worker Activity (Last 5 minutes):**

```
15:43:00 - Job executed: Skipped (after_market_close)
15:44:00 - Job executed: Skipped (after_market_close)
15:45:00 - Job executed: Skipped (after_market_close)
15:46:00 - Job executed: Skipped (after_market_close)
15:47:00 - Job executed: Skipped (after_market_close)
```

**Status**: ✅ Worker is executing jobs every minute as scheduled

### 4. Current Behavior

**⏰ MARKET HOURS CHECK**

- **Market Open**: 09:30 PKT
- **Market Close**: 15:30 PKT
- **Current Time**: ~15:47 PKT (after market close)

**Behavior**: Worker is correctly skipping ingestion during after-hours:
- ✅ Running every minute as scheduled
- ✅ Checking market hours
- ✅ Skipping ingestion when market is closed (after 15:30)
- ✅ Processing symbols when market is open

### 5. Job Processing Details

**Worker Configuration:**
- **Symbols Per Minute**: 20 (cohort-based)
- **Market Open Time**: 09:30
- **Market Close Time**: 15:30
- **Fetch Delay Minutes**: 2 (starts at 09:32)
- **Symbol Universe**: 75 symbols

**Cohort System:**
- Symbols are divided into cohorts (20 symbols per cohort)
- Each minute processes one cohort
- Rotates through all cohorts throughout the day
- With 75 symbols and 20 per cohort: ~4 cohorts

### 6. Skip Reasons

**Recent Skip Reasons:**
- `after_market_close` - Market is closed (15:30-15:47)
- Expected behavior: Worker should skip during after-hours

**During Market Hours (09:32 - 15:30):**
- Worker processes cohorts normally
- Fetches data via `/api/klines/{symbol}/1m` endpoint
- Inserts into `minute_bars` table

### 7. Expected Next Actions

**Next Market Open (Tomorrow 09:30):**
- ✅ Worker will start processing cohorts at 09:32 (after 2-minute delay)
- ✅ Will fetch 1-minute candles for 20 symbols per minute
- ✅ Will insert data into TimescaleDB

**Current Time (After Market Close):**
- ✅ Worker continues running
- ✅ Jobs execute every minute
- ✅ Correctly skips ingestion (market closed)
- ✅ Will resume automatically at 09:32 tomorrow

## ⚠️ CRITICAL ISSUES DETECTED

### Database Insertion Failures

**Error Pattern:**
```
ERROR: Ingestion job failed
  at async insertMinuteBars (file:///app/workers/ingestion/timescale.mjs:52:20)
```

**Observations:**
- ❌ Many jobs are failing during database insertion
- ⚠️ Failures occurring at `timescale.mjs:52` (INSERT query)
- ❌ Worker continues processing but data is not being stored
- ⚠️ This pattern repeated throughout market hours (14:06 - 14:36)

**Possible Causes:**
1. Database connection issues (connection pool exhausted?)
2. Database constraint violations (duplicate keys?)
3. Transaction timeouts
4. Database unavailable or slow responses

## 📊 SUMMARY

### ⚠️ NEEDS ATTENTION

**Worker Status**: ⚠️ **RUNNING BUT FAILING**

- ✅ Worker container is running
- ✅ Jobs are executing every minute
- ✅ Market hours check working correctly
- ✅ Jobs processing cohorts correctly
- ❌ **Database insertion failures** - data not being stored
- ✅ Correctly skipping during after-hours

**Recommendations:**
1. ⚠️ **URGENT**: Check database connection and `minute_bars` table
2. ⚠️ Check database logs for constraint violations
3. ⚠️ Verify database connection pool settings
4. ⚠️ Check if database is accessible from worker container
5. ✅ Monitor during market hours (09:30-15:30) after fixing database issues

## 🔧 To Check Detailed Queue Status

Run the status check script:

```bash
# From project root
docker exec my-cryptobubbles-worker-1 node workers/ingestion/check-status.mjs
```

Or check logs:

```bash
docker logs --tail 100 my-cryptobubbles-worker-1
```

## 📈 Metrics

To view Prometheus metrics:
- **Metrics Port**: 9100
- **Metrics Endpoint**: `http://localhost:9100/metrics`

Key metrics:
- `ingestion_jobs_total{status="success"}` - Successful jobs
- `ingestion_jobs_total{status="failed"}` - Failed jobs
- `ingestion_rows_last_batch` - Last batch size
- `ingestion_lag_seconds` - Data lag


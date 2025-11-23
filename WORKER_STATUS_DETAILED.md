# 🔍 DETAILED INGESTION WORKER STATUS REPORT

Generated: $(date)

## 1️⃣ WORKER RUNNING STATUS

**✅ WORKER IS RUNNING**
- **Container**: `my-cryptobubbles-worker-1`
- **Status**: Up 3+ hours
- **Process**: Node.js worker (`workers/ingestion/index.mjs`)
- **Queue**: BullMQ (`psx-fetch-minute-bars`)
- **Cron**: `* * * * *` (every minute)

## 2️⃣ LAST PROCESSED JOB TIMESTAMP

**Current Behavior:**
- Jobs executing every minute ✅
- **Last successful ingestion**: Unknown (many failures detected)
- **Last job execution**: ~15:47 (skipped - after market close)
- **During market hours (14:06-14:36)**: Multiple failures detected

**Recent Activity:**
- 15:43-15:47: Skipping correctly (after market close)
- 14:06-14:36: Processing attempts but **database insertion failures**

## 3️⃣ NEXT SCHEDULED JOB

**Next Run:**
- **Scheduled**: Every minute (cron: `* * * * *`)
- **Next execution**: Every minute starting from now
- **Market hours check**: Will skip until 09:30 tomorrow (09:32 with 2-min delay)

## 4️⃣ JOB FAILURES / SKIPS

### ⚠️ CRITICAL: Database Insertion Failures

**Failure Pattern:**
```
ERROR: Ingestion job failed
  at async insertMinuteBars (file:///app/workers/ingestion/timescale.mjs:52:20)
  at async processJob (file:///app/workers/ingestion/index.mjs:143:17)
```

**Failure Timeline (14:06 - 14:36):**
- Multiple failures every minute
- All failures at database insertion step
- Jobs were processing cohorts correctly
- API calls may have succeeded, but data insertion failed

**Skip Reasons (Current - After Hours):**
- ✅ `after_market_close` - Expected behavior
- Jobs correctly skipping during after-hours (15:30+)

**Expected Skips (During Market Hours):**
- `before_schedule_window` - Before 09:32
- `after_market_close` - After 15:30

## 🔧 ACTION REQUIRED

### Database Issue Investigation

**Check Database:**
```bash
# Check if database is accessible
docker exec my-cryptobubbles-worker-1 node -e "
import pg from 'pg';
const pool = new pg.Pool({
  host: 'timescale',
  port: 5432,
  database: 'cryptobubbles',
  user: 'postgres',
  password: 'postgres'
});
pool.query('SELECT NOW()').then(r => console.log('DB OK:', r.rows[0])).catch(e => console.error('DB ERROR:', e.message));
"

# Check worker logs for specific error messages
docker logs my-cryptobubbles-worker-1 2>&1 | grep -i "error\|failed" | tail -20
```

**Check Database Connection Pool:**
- Review `workers/ingestion/timescale.mjs` connection pool settings
- May need to increase pool size or check for connection leaks

**Check Table Constraints:**
```sql
-- Check for constraint issues
SELECT * FROM minute_bars ORDER BY ts DESC LIMIT 10;

-- Check table exists
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'minute_bars';
```

## 📊 SUMMARY

| Item | Status | Details |
|------|--------|---------|
| Worker Running | ✅ | Container up 3+ hours |
| Jobs Executing | ✅ | Every minute as scheduled |
| Market Hours Check | ✅ | Correctly skipping after-hours |
| Database Insertion | ❌ | **Failures detected** |
| Last Successful Job | ❓ | Unknown (many failures) |
| Next Scheduled Job | ✅ | Every minute |

**Status**: ⚠️ **RUNNING BUT NEEDS ATTENTION**

**Priority Issues:**
1. 🔴 **URGENT**: Fix database insertion failures
2. 🔴 Check database connectivity
3. 🔴 Review error logs for specific failure reasons


# Worker Verification Steps

## Quick Verification Checklist

### 1. Verify Symbols Exist (1 min)
```bash
docker exec my-cryptobubbles-timescale-1 psql -U postgres -d cryptobubbles -f /path/to/db/verify-cohort-symbols.sql
```

**Expected**: All 20 symbols present and active

### 2. Wait for Next Minute Job (1 min)
```bash
# Wait until next minute starts (e.g., if current time is 16:05, wait until 16:06)
# Worker runs every minute at :00 seconds
```

### 3. Check Worker Logs (30 sec)
```bash
docker logs --tail 50 --follow my-cryptobubbles-worker-1
```

**Look for**:
- ✅ `"Processing ingestion cohort"`
- ✅ `"Ingested minute bars cohort"`
- ❌ Should NOT see: `"foreign key constraint"` or `"Ingestion job failed"`

### 4. Verify Data Inserted (30 sec)
```sql
-- Check latest inserts
SELECT 
  symbol, 
  ts, 
  close, 
  volume
FROM minute_bars
WHERE ts >= NOW() - INTERVAL '5 minutes'
ORDER BY ts DESC
LIMIT 20;
```

**Expected**: Recent rows with today's timestamp

### 5. Check Foreign Key Status (30 sec)
```sql
-- Verify no foreign key violations
SELECT 
  COUNT(*) as total_rows,
  COUNT(DISTINCT symbol) as unique_symbols,
  MAX(ts) as latest_timestamp
FROM minute_bars
WHERE ts >= CURRENT_DATE;
```

**Expected**: Rows with recent timestamps, no errors

---

## One-Command Quick Check

```bash
# Run all checks at once
docker exec my-cryptobubbles-worker-1 sh -c "
  echo '1. Checking latest worker logs...';
  docker logs --tail 10 my-cryptobubbles-worker-1 | grep -E 'Ingested|failed|Processing';
  echo '';
  echo '2. Checking database for recent inserts...';
  node -e \"
    import('./workers/ingestion/timescale.mjs').then(async m => {
      const result = await m.withClient(async client => {
        return await client.query(\"
          SELECT COUNT(*) as count, MAX(ts) as latest 
          FROM minute_bars 
          WHERE ts >= CURRENT_DATE
        \");
      });
      console.log('Today rows:', result.rows[0].count);
      console.log('Latest:', result.rows[0].latest);
    });
  \"
"
```

---

## Expected Output After Fix

### ✅ Success Indicators:
1. Worker logs show: `"Ingested minute bars cohort"` with `inserted` count > 0
2. Database has recent rows: `ts >= NOW() - 5 minutes`
3. No foreign key errors in logs
4. `minute_bars` table shows new rows with current cohort symbols

### ❌ Failure Indicators:
1. Worker logs show: `"foreign key constraint"` error
2. Worker logs show: `"Ingestion job failed"`
3. Database query returns no recent rows
4. Symbols still missing from `instruments` table

---

## Quick Fix If Still Failing

If foreign key error persists:
```sql
-- Re-run insert for all 20 symbols
INSERT INTO instruments (symbol, name, active)
VALUES 
  ('GATM', 'GATM', true), ('QUICE', 'QUICE', true),
  ('SSGC', 'SSGC', true), ('DGKC', 'DGKC', true),
  ('FFC', 'FFC', true), ('PPL', 'PPL', true),
  ('POWER', 'POWER', true), ('SEARL', 'SEARL', true),
  ('ATRL', 'ATRL', true), ('FFL', 'FFL', true),
  ('SLGL', 'SLGL', true), ('CEPB', 'CEPB', true),
  ('SNGP', 'SNGP', true), ('DCL', 'DCL', true),
  ('UNITY', 'UNITY', true), ('ASL', 'ASL', true),
  ('MUGHAL', 'MUGHAL', true), ('FCL', 'FCL', true),
  ('TGL', 'TGL', true), ('MACFL', 'MACFL', true)
ON CONFLICT (symbol) DO UPDATE SET active = true;
```


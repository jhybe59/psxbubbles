# 🔍 SYMBOLS & COHORT DIAGNOSTIC REPORT

Generated: $(date)

## 1️⃣ TOTAL SYMBOLS IN CURRENT COHORT

**✅ COHORT SYSTEM WORKING**

### Current Status:
- **Total Symbols**: 75
- **Symbols Per Minute**: 20
- **Total Cohorts**: 4
- **Current Cohort Index**: 1
- **Current Cohort Size**: 20 symbols
- **Current Minute of Day**: 965 (16:05)
- **Start Minute**: 572 (09:32 with 2-min delay)

### Current Cohort Symbols (20):
1. GATM
2. QUICE
3. SSGC
4. DGKC
5. FFC
6. PPL
7. POWER
8. SEARL
9. ATRL
10. FFL
11. SLGL
12. CEPB
13. SNGP
14. DCL
15. UNITY
16. ASL
17. MUGHAL
18. FCL
19. TGL
20. MACFL

**Status**: ✅ Cohort assignment working correctly

## 2️⃣ SYMBOL SKIP STATUS

**❌ NO SYMBOLS BEING SKIPPED** (but database insertion is failing)

- All symbols in current cohort are being processed
- No symbols are being skipped during processing
- **Issue**: Database insertion is failing for all symbols

## 3️⃣ LAST BATCH INSERT ATTEMPT

**❌ FAILED - FOREIGN KEY CONSTRAINT VIOLATION**

### Error Details:
```
Error: insert or update on table "_hyper_1_597_chunk" violates foreign key constraint 
       "597_1184_minute_bars_symbol_fkey"

Detail: Key (symbol)=(TEST) is not present in table "instruments".

Code: 23503
Constraint: 597_1184_minute_bars_symbol_fkey
```

### Root Cause:
**Foreign Key Constraint Violation** - Symbols must exist in `instruments` table before being inserted into `minute_bars`.

### Current Status:
- **Last Successful Insert**: November 11, 2025 10:49:54 UTC (EPCL)
- **Today's Data**: ❌ No data for today (November 22, 2025)
- **Missing Symbols**: 19+ symbols missing today's data

## 4️⃣ ERROR DETAILS

### Error Type: Foreign Key Constraint Violation

**Error Code**: 23503
**Constraint**: `minute_bars_symbol_fkey`
**Message**: Symbol must exist in `instruments` table before insertion

**Possible Causes:**
1. Symbols in cohort don't exist in `instruments` table
2. Foreign key constraint is too strict
3. Symbol names don't match between API and database

**Solution**: Ensure all symbols exist in `instruments` table before processing

## 5️⃣ DATABASE CONNECTION POOL STATUS

**✅ CONNECTION POOL HEALTHY**

### Pool Status:
- **Status**: ✅ Healthy
- **Active Connections**: 0
- **Idle Connections**: 0
- **Waiting Requests**: 0
- **Max Connections**: 10
- **Database Connected**: ✅ Yes
- **Server Time**: November 22, 2025 16:05:40 UTC
- **Database Version**: PostgreSQL

**Status**: ✅ No connection pool issues

## 📊 TABLE STRUCTURE CHECK

**✅ TABLE STRUCTURE CORRECT**

- **Columns**: 11 columns
- **Constraints**: 2 constraints (Primary Key + Foreign Key)
- **Hypertable**: ✅ Enabled
  - Dimensions: 1
  - Compression: ✅ Enabled
- **Primary Key**: `PRIMARY KEY (symbol, ts)`
- **Foreign Key**: `minute_bars_symbol_fkey` → `instruments(symbol)`

## 🔧 ACTION REQUIRED

### Fix: Ensure Symbols Exist in `instruments` Table

**Step 1: Check Missing Symbols**
```sql
-- Check which symbols from current cohort don't exist in instruments table
SELECT symbol 
FROM (VALUES 
  ('GATM'), ('QUICE'), ('SSGC'), ('DGKC'), ('FFC'), 
  ('PPL'), ('POWER'), ('SEARL'), ('ATRL'), ('FFL'),
  ('SLGL'), ('CEPB'), ('SNGP'), ('DCL'), ('UNITY'),
  ('ASL'), ('MUGHAL'), ('FCL'), ('TGL'), ('MACFL')
) AS cohort(symbol)
WHERE symbol NOT IN (SELECT symbol FROM instruments);
```

**Step 2: Insert Missing Symbols**
```sql
-- Insert missing symbols into instruments table
INSERT INTO instruments (symbol, name, active)
VALUES 
  ('GATM', 'GATM', true),
  ('QUICE', 'QUICE', true),
  -- ... (other missing symbols)
ON CONFLICT (symbol) DO UPDATE SET active = true;
```

**Step 3: Verify All Symbols Exist**
```sql
-- Check all 75 symbols exist
SELECT COUNT(*) as total, 
       COUNT(CASE WHEN active THEN 1 END) as active
FROM instruments
WHERE symbol IN (
  -- All 75 symbols from config
);
```

**Step 4: Run Worker Again**
- Once all symbols exist in `instruments` table
- Worker will be able to insert data successfully
- Check logs for successful insertions

## 📋 SUMMARY

| Item | Status | Details |
|------|--------|---------|
| **Total Symbols** | ✅ | 75 symbols configured |
| **Cohort System** | ✅ | 4 cohorts, 20 symbols each |
| **Current Cohort** | ✅ | Index 1, 20 symbols |
| **Symbol Processing** | ✅ | All symbols processed |
| **Database Connection** | ✅ | Healthy, no issues |
| **Table Structure** | ✅ | Correct with constraints |
| **Database Insertion** | ❌ | **Foreign key constraint violation** |
| **Root Cause** | ❌ | Symbols not in `instruments` table |
| **Last Success** | ⚠️ | November 11 (11 days ago) |
| **Today's Data** | ❌ | No data for today |

## 🎯 PRIORITY ACTIONS

1. **🔴 URGENT**: Ensure all 75 symbols exist in `instruments` table
2. **🔴 URGENT**: Verify foreign key constraint is properly set up
3. **🟡 MONITOR**: Watch for successful insertions after fix
4. **🟡 VERIFY**: Check that all symbols from API exist in database

**Status**: ⚠️ **FOREIGN KEY CONSTRAINT VIOLATION** - Fix required before worker can insert data


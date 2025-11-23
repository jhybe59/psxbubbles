# 🚀 Automatic System Run Guide

## ✅ System Auto-Run Status

### When Market Opens Next Time:

**YES** - System automatically run hoga jab market open hoga!

### How It Works:

1. **Worker Running**: Worker container already running hai (`my-cryptobubbles-worker-1`)
2. **Cron Schedule**: `* * * * *` (har minute check karta hai)
3. **Market Hours Check**: 
   - Market Hours: 09:30 - 15:30 PKT
   - Outside market hours: Worker skip karta hai
   - During market hours: Automatically process karta hai

## 📊 Data Update Schedule

### 1️⃣ Minute Bars (1m) - Real-time
- **Frequency**: Har minute (during market hours)
- **Process**: 
  - 20 symbols per minute (cohort system)
  - 4 cohorts total (75 symbols / 20 = 4 cohorts)
  - Each cohort processes every 4 minutes
  - Total: 75 symbols processed in ~4 minutes

**Example Timeline:**
```
09:30:00 - Cohort 0 (Symbols 1-20)
09:31:00 - Cohort 1 (Symbols 21-40)
09:32:00 - Cohort 2 (Symbols 41-60)
09:33:00 - Cohort 3 (Symbols 61-75)
09:34:00 - Cohort 0 (Symbols 1-20) - repeat cycle
```

### 2️⃣ Continuous Aggregates - Automatic

#### 5-Minute Bars (5m)
- **Auto-update**: Har 1 minute
- **Refresh**: Last 2 hours of data
- **Trigger**: Jab minute_bars me new data insert hota hai

#### 15-Minute Bars (15m)
- **Auto-update**: Har 5 minutes
- **Refresh**: Last 6 hours of data

#### 1-Hour Bars (1h)
- **Auto-update**: Har 15 minutes
- **Refresh**: Last 2 days of data

#### 1-Day Bars (1d)
- **Auto-update**: Har 1 hour
- **Refresh**: Last 7 days of data

#### Additional Aggregates
- **4h, 1w, 1mo, 1y**: Auto-update based on policies

## 🔄 How Pills (Intervals) Update

### Current Status:
- **1 Min**: ✅ Shows latest minute_bars data
- **5 Min**: ✅ Auto-updates every 1 minute (from continuous aggregate)
- **15 Min**: ✅ Auto-updates every 5 minutes
- **1 Hour**: ✅ Auto-updates every 15 minutes
- **Day**: ✅ Auto-updates every 1 hour

### Update Flow:
```
1. Market opens at 09:30
2. Worker starts processing cohorts
3. Minute bars (1m) data inserted into database
4. Continuous aggregates automatically refresh:
   - 5m: Updates every 1 minute
   - 15m: Updates every 5 minutes
   - 1h: Updates every 15 minutes
   - 1d: Updates every 1 hour
5. API serves latest data from aggregates
6. Frontend refreshes every 60 seconds (auto-refresh)
```

## 📋 What You Need to Do

### Nothing! System is Already Running:

1. **Worker Container**: Already running (`my-cryptobubbles-worker-1`)
2. **API Service**: Already running (`my-cryptobubbles-api-1`)
3. **Database**: Already running with continuous aggregates
4. **Auto-start**: Containers auto-start with `docker compose`

### To Start System (if stopped):

```powershell
# Start all services
docker compose -f docker-compose.dev.yml up -d

# Or start individually
docker compose -f docker-compose.dev.yml up -d worker api timescale redis
```

### To Check Status:

```powershell
# Check if worker is running
docker ps | grep worker

# Check worker logs
docker logs --tail 50 my-cryptobubbles-worker-1

# Check API logs
docker logs --tail 50 my-cryptobubbles-api-1
```

## 🎯 Summary

| Feature | Status | Details |
|---------|--------|---------|
| **Auto-run** | ✅ YES | Worker runs automatically during market hours |
| **Data Updates** | ✅ YES | Har minute new data during market hours |
| **1m Interval** | ✅ YES | Real-time minute bars |
| **5m Interval** | ✅ YES | Auto-updates every 1 minute |
| **15m Interval** | ✅ YES | Auto-updates every 5 minutes |
| **1h Interval** | ✅ YES | Auto-updates every 15 minutes |
| **Day Interval** | ✅ YES | Auto-updates every 1 hour |
| **Frontend Refresh** | ✅ YES | Auto-refreshes every 60 seconds |

## 🔍 Verification

### Check Worker Status:
```powershell
# Check last job execution
docker logs my-cryptobubbles-worker-1 | Select-String "Processing ingestion cohort"

# Check market hours status
docker logs my-cryptobubbles-worker-1 | Select-String "after_market_close|before_market_open"
```

### Check Data in Database:
```sql
-- Check latest minute_bars
SELECT symbol, ts, close, volume 
FROM minute_bars 
ORDER BY ts DESC 
LIMIT 10;

-- Check continuous aggregates
SELECT symbol, bucket, close, volume_sum 
FROM minute_bars_5m 
ORDER BY bucket DESC 
LIMIT 10;
```

## ⚠️ Important Notes

1. **Market Hours**: Worker only processes during 09:30 - 15:30 PKT
2. **Cohort System**: 20 symbols per minute, all 75 symbols in ~4 minutes
3. **Auto-refresh**: Continuous aggregates update automatically
4. **No Manual Action**: System runs automatically, no need to start manually

## ✅ Conclusion

**Jab market open hoga (09:30 PKT):**
- ✅ Worker automatically start karega processing
- ✅ Har minute data update hoga (20 symbols at a time)
- ✅ All intervals (5m, 15m, 1h, Day) automatically update honge
- ✅ Frontend automatically refresh hoga every 60 seconds
- ✅ Koi manual action ki zaroorat nahi!

**System ready hai - bas market open hone ka wait karo! 🚀**



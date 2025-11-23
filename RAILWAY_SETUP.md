# Railway Deployment Setup Guide

Yeh guide Railway pe services setup karne ke liye hai. Har step follow karein.

## Prerequisites

- Railway account (https://railway.app)
- GitHub repo connected to Railway
- Postgres database already created on Railway

## Step 1: Services Create Karein

Railway pe 3 services create karni hain:

### 1. Web Service (Frontend)

1. Railway project dashboard → **"+ Create"** button (top-right)
2. **"GitHub Repo"** select karein
3. `jhybe59/psxbubbles` repo select karein
4. Service name: **`web`** (exactly yeh naam)
5. Railway automatically `railway.toml` detect karega aur Nixpacks se build karega
6. Deploy hone do

### 2. API Service (Backend)

1. Railway project dashboard → **"+ Create"** button
2. **"GitHub Repo"** select karein
3. `jhybe59/psxbubbles` repo select karein
4. Service name: **`api`** (exactly yeh naam)
5. Service open karein → **Settings** tab
6. **Builder** section mein:
   - Builder type: **"Dockerfile"** select karein
   - Dockerfile path: **`Dockerfile.api`** enter karein
7. **Networking** section:
   - Port: **8080** (auto-detect ho sakta hai)
8. Save karein aur deploy hone do

### 3. Worker Service (Optional - Data Ingestion)

1. Railway project dashboard → **"+ Create"** button
2. **"GitHub Repo"** select karein
3. `jhybe59/psxbubbles` repo select karein
4. Service name: **`worker`** (exactly yeh naam)
5. Service open karein → **Settings** tab
6. **Builder** section:
   - Builder type: **"Dockerfile"** select karein
   - Dockerfile path: **`Dockerfile.worker`** enter karein
7. Save karein (abhi deploy nahi karna, pehle variables set karein)

## Step 2: Environment Variables Set Karein

### Postgres Database URL Copy Karein

1. Railway dashboard → **Postgres** service open karein
2. **"Connect"** tab click karein
3. **"DATABASE_URL"** copy karein (yeh format hoga: `postgresql://user:pass@host:port/db?sslmode=require`)

### API Service Variables

1. **API** service open karein
2. **"Variables"** tab click karein
3. Add karein:
   - **Key:** `DATABASE_URL`
   - **Value:** (Postgres se copy kiye hue DATABASE_URL paste karein)
4. (Optional) Agar Redis use karna hai:
   - **Key:** `REDIS_URL`
   - **Value:** (Redis service se Connect tab se copy karein)
5. Save karein

### Worker Service Variables (Agar create kiya)

1. **Worker** service open karein
2. **"Variables"** tab click karein
3. Add karein:
   - **Key:** `DATABASE_URL`
   - **Value:** (same Postgres DATABASE_URL)
4. (Optional) Redis:
   - **Key:** `REDIS_URL`
   - **Value:** (Redis URL agar use karna hai)
5. (Optional) PSX API token agar live data chahiye:
   - **Key:** `PSX_API_TOKEN`
   - **Value:** (your PSX API token)
6. Save karein

## Step 3: Database Migrations Run Karein

1. **API** service open karein
2. **"Deployments"** tab → latest deployment click karein
3. **"Run Command"** button click karein
4. Command enter karein: `npm run db:migrate`
5. Run karein
6. Logs check karein - "Completed all migrations" dikhna chahiye

(Optional) Sample data seed karna:
- Same "Run Command" se: `npm run db:seed`

## Step 4: Verify Services

### Web Service Check

1. **Web** service open karein
2. **"Settings"** tab → **"Generate Domain"** click karein
3. Domain URL copy karein (e.g., `https://web-production-xxxx.up.railway.app`)
4. Browser mein open karein - frontend load hona chahiye

### API Service Check

1. **API** service open karein
2. **"Settings"** tab → **"Generate Domain"** click karein
3. Domain URL copy karein (e.g., `https://api-production-xxxx.up.railway.app`)
4. Browser mein test karein:
   - Health check: `https://api-production-xxxx.up.railway.app/api/health`
   - Bubbles endpoint: `https://api-production-xxxx.up.railway.app/api/bubbles?interval=5m&limit=50`

## Step 5: Auto-Deploy Setup

Auto-deploy already setup hai agar services GitHub repo se connected hain:

1. Koi bhi change GitHub pe push karein
2. Railway automatically detect karega
3. Services automatically rebuild aur redeploy hongi
4. Railway dashboard → **"Activity"** tab se status check kar sakte hain

## Troubleshooting

### Web Service Build Fail

- **Error:** "vite: Permission denied"
- **Solution:** `NIXPACKS_PRUNE_DEV_DEPENDENCIES=false` already set hai `railway.toml` mein. Agar phir bhi fail ho, manually API service → Variables → add karein: `NIXPACKS_PRUNE_DEV_DEPENDENCIES=false`

### API Service Database Connection Fail

- **Error:** "Connection refused" ya "SSL required"
- **Solution:** 
  - Check karein `DATABASE_URL` correctly set hai
  - Railway Postgres automatically SSL require karta hai - code already handle karta hai

### Port Issues

- **Error:** Service start nahi ho rahi
- **Solution:** 
  - API service → Settings → Networking → Port 8080 set karein
  - Ya Railway automatically detect karega (EXPOSE 8080 Dockerfile mein hai)

## Next Steps

1. Web service ka domain frontend ke liye use karein
2. API service ka domain frontend code mein update karein (agar needed)
3. Worker service start karein agar live data ingestion chahiye
4. Monitoring ke liye Railway → Observability tab use karein

## Important Notes

- **DATABASE_URL** Railway Postgres se automatically SSL enabled hota hai
- **Redis** optional hai - agar nahi hai, API in-memory cache use karega
- **Worker** service optional hai - agar PSX API token nahi hai, skip kar sakte hain
- Har service ka apna domain URL hoga - custom domain bhi set kar sakte hain

---

**Support:** Agar koi issue aaye, Railway logs check karein (service → Logs tab) ya GitHub issues create karein.


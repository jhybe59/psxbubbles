# Railway Deployment Setup Guide

Yeh guide Railway pe services setup karne ke liye hai. Har step follow karein.

## Prerequisites

- Railway account (https://railway.app)
- GitHub repo connected to Railway
- Postgres database already created on Railway

## Step 1: Services Create Karein

Railway pe 4 services create karni hain:

### 1. Web Service (Frontend)

1. Railway project dashboard → **"+ Create"** button (top-right)
2. **"GitHub Repo"** select karein
3. `jhybe59/psxbubbles` repo select karein
4. Service name: **`web`** (exactly yeh naam)
5. Railway automatically `railway.toml` detect karega aur Nixpacks se build karega
6. Deploy hone do

### 2. QuestDB Service (Database)

1. Railway project dashboard → **"+ Create"** button
2. **"Docker Image"** select karein
3. Image name: **`questdb/questdb:latest`** enter karein
4. Service name: **`questdb`** settings mein change karein
5. Service open karein → **Settings** tab:
   - **Networking** section mein ports add karein:
     - **9000** (Select HTTP)
     - **9009** (Select TCP for ingestion)
6. **Variables** tab mein add karein:
   - `QDB_CAIRO_COMMIT_LAG` = `1000`
   - `QDB_CAIRO_MAX_UNCOMMITTED_ROWS` = `1000`
7. Deploy hone do

### 3. API Service (Backend)

1. Railway project dashboard → **"+ Create"** button
2. **"GitHub Repo"** select karein
3. `jhybe59/psxbubbles` repo select karein
4. Service name: **`api`** (exactly yeh naam)
5. Service open karein → **Settings** tab
6. **Builder** section mein:
   - Builder type: **"Dockerfile"** select karein
   - Dockerfile path: **`Dockerfile.api`** enter karein
7. **Networking** section:
   - Port: **8080**
8. Save karein

### 4. Worker Service (Data Ingestion)

1. Railway project dashboard → **"+ Create"** button
2. **"GitHub Repo"** select karein
3. `jhybe59/psxbubbles` repo select karein
4. Service name: **`worker`** (exactly yeh naam)
5. Service open karein → **Settings** tab
6. **Builder** section:
   - Builder type: **"Dockerfile"** select karein
   - Dockerfile path: **`Dockerfile.worker`** enter karein
7. Save karein

## Step 2: Environment Variables Set Karein

### Postgres Database URL Copy Karein

1. Railway dashboard → **Postgres** service open karein
2. **"Connect"** tab click karein
3. **"DATABASE_URL"** copy karein (yeh format hoga: `postgresql://user:pass@host:port/db?sslmode=require`)

### QuestDB Internal Hostname

1. QuestDB service Railway ke internal network pe access hoga
2. Host: `questdb` (service name)
3. HTTP Port: `9000`
4. ILP Port: `9009`

### API Service Variables

1. **API** service open karein
2. **"Variables"** tab click karein
3. Add karein:
   - **Key:** `DATABASE_URL`
   - **Value:** (Postgres se copy kiye hue DATABASE_URL paste karein)
   - **Key:** `QUESTDB_HOST`
   - **Value:** `questdb` (private networking hostname)
   - **Key:** `QUESTDB_HTTP_PORT`
   - **Value:** `9000`
4. Save karein

### Worker Service Variables

1. **Worker** service open karein
2. **"Variables"** tab click karein
3. Add karein:
   - **Key:** `DATABASE_URL`
   - **Value:** (same Postgres DATABASE_URL)
   - **Key:** `QUESTDB_HOST`
   - **Value:** `questdb`
   - **Key:** `QUESTDB_ILP_PORT`
   - **Value:** `9009`
   - **Key:** `PSX_API_TOKEN`
   - **Value:** (your PSX API token)
4. Save karein

## Step 3: Database Migrations Run Karein

1. **API** service open karein
2. **"Deployments"** tab → latest deployment click karein
3. **"Run Command"** button click karein
4. Command enter karein: `npm run db:migrate`
5. Run karein
6. Logs check karein - "Completed all migrations" dikhna chahiye

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

## Step 5: Auto-Deploy Setup

Auto-deploy already setup hai agar services GitHub repo se connected hain:

1. Koi bhi change GitHub pe push karein
2. Railway automatically detect karega
3. Services automatically rebuild aur redeploy hongi
4. Railway dashboard → **"Activity"** tab se status check kar sakte hain

## Troubleshooting

### API Service Database Connection Fail

- **Error:** "Connection refused" ya "SSL required"
- **Solution:** 
  - Check karein `DATABASE_URL` correctly set hai
  - Check karein `QUESTDB_HOST` `questdb` set hai aur service running hai

### Port Issues

- **Error:** Service start nahi ho rahi
- **Solution:** 
  - API service → Settings → Networking → Port 8080 set karein

## Next Steps

1. Web service ka domain frontend ke liye use karein
2. Worker service start karein live data ingestion ke liye
3. QuestDB data populate hone ka wait karein

---

**Support:** Agar koi issue aaye, Railway logs check karein (service → Logs tab).

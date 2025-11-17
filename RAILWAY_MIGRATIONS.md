# Railway Database Migrations - Step by Step Guide

## Method 1: Railway CLI Use Karein (Easiest)

### Step 1: Railway CLI Install Karein

**Windows (PowerShell):**
```powershell
# Railway CLI install karein
iwr https://railway.app/install.ps1 | iex
```

Ya phir manually:
1. https://railway.app/cli pe jao
2. Windows installer download karein
3. Install karein

### Step 2: Railway Login Karein

```powershell
railway login
```

Browser automatically open hoga, Railway account se login karein.

### Step 3: Project Link Karein

```powershell
# Project directory mein jao
cd C:\Users\jbawa\my-cryptobubbles

# Railway project link karein
railway link
```

Project select karein: `eloquent-growth`

### Step 4: API Service Select Karein

```powershell
railway service
```

List se `api` select karein.

### Step 5: Migrations Run Karein

```powershell
railway run npm run db:migrate
```

Yeh command API service ke container mein migrations run karega.

### Step 6: Verify Karein

Logs check karein - "Completed all migrations" dikhna chahiye.

---

## Method 2: Local Se Direct Database Connect Karein

Agar Railway CLI install nahi karna chahte, to local se directly Railway Postgres connect karke migrations run kar sakte hain.

### Step 1: Postgres Connection String Copy Karein

1. Railway dashboard → **Postgres** service
2. **"Connect"** tab
3. **"DATABASE_URL"** copy karein

### Step 2: Local .env File Mein Add Karein

Local project mein `.env` file create/update karein:

```env
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require
TIMESCALE_SSL=true
```

### Step 3: Local Se Migrations Run Karein

```powershell
npm run db:migrate
```

Yeh directly Railway Postgres pe migrations run karega.

---

## Method 3: API Service Mein Migration Endpoint Add Karein (Advanced)

Agar dono methods nahi chal rahe, to main API service mein ek admin endpoint add kar sakta hoon jo migrations run kare. Lekin yeh security risk hai, isliye pehle do methods try karein.

---

## Troubleshooting

### Railway CLI Install Issues

- **Error:** "railway: command not found"
- **Solution:** 
  - PowerShell restart karein
  - Ya manually PATH add karein

### Connection Issues

- **Error:** "Connection refused"
- **Solution:**
  - Check karein `DATABASE_URL` correctly set hai
  - Railway Postgres service running hai
  - SSL enabled hai (Railway automatically require karta hai)

### Migration Errors

- **Error:** "relation already exists"
- **Solution:** Migrations already run ho chuki hain - theek hai

---

## Next Steps After Migrations

1. **Verify Tables:**
   - Railway Postgres → Database tab → Data tab
   - Tables dikhni chahiye

2. **Optional - Seed Data:**
   ```powershell
   railway run npm run db:seed
   ```

3. **Test API:**
   - Browser mein: `https://api-production-b156.up.railway.app/api/health`
   - Response: `{"status":"ok"}` aana chahiye

---

**Recommendation:** Method 1 (Railway CLI) use karein - sabse simple aur safe hai.


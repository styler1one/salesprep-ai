# Railway Deployment Guide

## Stap 1: Create New Project

1. **Ga naar**: https://railway.app/new
2. **Login** met je GitHub account
3. **Deploy from GitHub repo**:
   - Click "Deploy from GitHub repo"
   - Select `salesprep-ai`
   - Click "Deploy Now"

## Stap 2: Configure Service

Railway detecteert automatisch Python. Nu configureren:

1. **Click op de service** (in het diagram)
2. **Go to "Settings"**
3. **Root Directory**: `backend` ⚠️ **BELANGRIJK**
   - Scroll naar "Root Directory"
   - Type: `backend`
4. **Start Command**:
   - Scroll naar "Start Command"
   - Type: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## Stap 3: Environment Variables

1. **Go to "Variables" tab**
2. **Add variables**:

```
SUPABASE_URL = [Krijg je van Supabase - zie DEPLOY_SUPABASE.md]
SUPABASE_SERVICE_ROLE_KEY = [Krijg je van Supabase]
DATABASE_URL = [Krijg je van Supabase]
ENVIRONMENT = production
ALLOWED_ORIGINS = https://salesprep-ai-xxx.vercel.app
```

**Voor nu**: Laat SUPABASE vars leeg, we vullen dit in na Supabase setup

**ALLOWED_ORIGINS**: Vervang met je Vercel URL (van vorige stap)

## Stap 4: Generate Domain

1. **Go to "Settings" → "Networking"**
2. **Click "Generate Domain"**
3. Je krijgt een URL zoals: `https://salesprep-ai-production.up.railway.app`
4. **Kopieer deze URL** - je hebt hem nodig voor Vercel!

## Stap 5: Redeploy

1. **Go to "Deployments"**
2. **Click "Redeploy"** (om env vars te activeren)
3. Wacht 1-2 minuten

## Stap 6: Test Deployment

Ga naar je Railway URL. Je zou moeten zien:

```json
{
  "message": "Welcome to SalesPrep AI API",
  "version": "1.0.0",
  "status": "running",
  "docs": "/docs"
}
```

**Test ook**: `[YOUR-URL]/docs` voor API documentation ✅

**Als je errors ziet**:
- Check deployment logs in Railway
- Meestal: Missing environment variables (normaal, we vullen die later in)

---

## Update Vercel met Railway URL

Nu je Railway URL hebt:

1. Ga naar Vercel dashboard
2. Select je project
3. Settings → Environment Variables
4. Add: `NEXT_PUBLIC_API_URL` = `https://salesprep-ai-production.up.railway.app`
5. Redeploy

---

**Klaar? Ga naar Supabase setup!**

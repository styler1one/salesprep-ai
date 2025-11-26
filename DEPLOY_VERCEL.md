# Vercel Deployment Guide

## Stap 1: Connect GitHub Repository

1. **Ga naar**: https://vercel.com/new
2. **Login** met je GitHub account (als je dat nog niet hebt gedaan)
3. **Import Git Repository**:
   - Je ziet je `salesprep-ai` repository
   - Click "Import"

## Stap 2: Configure Project

**Framework Preset**: Next.js (auto-detected) ✅

**Root Directory**: `frontend` ⚠️ **BELANGRIJK**
- Click "Edit" naast Root Directory
- Type: `frontend`
- Dit vertelt Vercel waar de Next.js app staat

**Build Settings** (auto-detected):
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

## Stap 3: Environment Variables

Click "Environment Variables" en voeg toe:

```
NEXT_PUBLIC_SUPABASE_URL = [Krijg je van Supabase - stap 5]
NEXT_PUBLIC_SUPABASE_ANON_KEY = [Krijg je van Supabase - stap 5]
NEXT_PUBLIC_API_URL = [Krijg je van Railway - stap 4]
```

**Voor nu**: Laat leeg, we vullen dit in na Supabase/Railway setup

## Stap 4: Deploy

1. Click "Deploy"
2. Wacht 2-3 minuten
3. Je krijgt een URL zoals: `https://salesprep-ai-xxx.vercel.app`

## Stap 5: Test Deployment

Ga naar je Vercel URL. Je zou moeten zien:
- "Welcome to SalesPrep AI" ✅
- Groene badge "Frontend is running!" ✅

**Als je errors ziet**:
- Check build logs in Vercel dashboard
- Meestal: Missing environment variables (normaal, we vullen die later in)

---

## Na Railway + Supabase Setup

1. Ga naar Vercel dashboard
2. Select je project
3. Go to "Settings" → "Environment Variables"
4. Add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL`
5. Redeploy (Deployments → ... → Redeploy)

---

**Klaar? Ga naar Railway setup!**

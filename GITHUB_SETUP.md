# GitHub Repository Setup

## Stap 1: Maak GitHub Repository

1. Ga naar: https://github.com/new
2. Repository name: `salesprep-ai`
3. Description: "AI-powered sales enablement platform"
4. Visibility: **Public** ⚠️ (vereist voor Vercel gratis tier)
5. **NIET** initialiseren met README (we hebben al een README)
6. Click "Create repository"

## Stap 2: Connect Local Repo to GitHub

GitHub geeft je commando's. Run deze in PowerShell:

```powershell
cd "G:\My Drive\_Agentboss\SalesAgent\code\salesprep-ai"

# Add remote
git remote add origin https://github.com/[YOUR-USERNAME]/salesprep-ai.git

# Add all files
git add .

# Commit
git commit -m "Initial commit: Project setup with Next.js frontend and FastAPI backend"

# Push to GitHub
git branch -M main
git push -u origin main
```

**Vervang `[YOUR-USERNAME]`** met je GitHub username!

## Stap 3: Verifieer op GitHub

Ga naar: `https://github.com/[YOUR-USERNAME]/salesprep-ai`

Je zou moeten zien:
- ✅ frontend/ folder
- ✅ backend/ folder
- ✅ README.md
- ✅ .gitignore
- ❌ GEEN .env files (beschermd door .gitignore)
- ❌ GEEN node_modules (beschermd door .gitignore)

---

## Volgende Stap: Deployment

Na GitHub push:
1. Vercel deployment (frontend)
2. Railway deployment (backend)
3. Supabase setup (database)

---

**Klaar met GitHub? Laat me weten!**

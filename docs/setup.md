# Development Setup Guide

## Prerequisites

- Node.js 18+ installed
- Python 3.11+ installed
- Git installed
- Supabase account (free tier)

## Quick Setup

### 1. Frontend Setup

```powershell
cd frontend

# Install dependencies (NOTE: May have issues on Google Drive)
# If npm install fails, try running from a local drive (C:\Dev)
npm install

# Copy environment variables
copy env.example .env.local

# Edit .env.local and add your Supabase credentials

# Run development server
npm run dev
```

Frontend will be available at: http://localhost:3000

### 2. Backend Setup

```powershell
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
copy env.example .env

# Edit .env and add your Supabase credentials

# Run development server
python main.py
# OR
uvicorn main:app --reload
```

Backend will be available at: http://localhost:8000
API docs at: http://localhost:8000/docs

## Environment Variables

### Frontend (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (.env)

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:3000
```

## Supabase Setup

1. Go to https://supabase.com
2. Create new project (Europe/Frankfurt region)
3. Get credentials from Settings → API
4. Create initial tables (see database/schema.sql)

## Troubleshooting

### npm install fails on Google Drive

Google Drive sync can interfere with npm. Solutions:
1. Move project to local drive (C:\Dev)
2. Pause Google Drive sync during install
3. Use `npm install --prefer-offline`

### Python venv activation fails

Make sure you're using PowerShell (not CMD) on Windows.

### CORS errors

Check that `ALLOWED_ORIGINS` in backend .env includes your frontend URL.

## Next Steps

After setup is complete:
1. Test frontend: http://localhost:3000
2. Test backend: http://localhost:8000/health
3. Check API docs: http://localhost:8000/docs
4. Start building features!

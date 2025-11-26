# Supabase Setup Guide

## Stap 1: Create Project

1. **Ga naar**: https://supabase.com
2. **Sign up / Login**
3. **Click "New Project"**

## Stap 2: Project Configuration

- **Name**: `salesprep-ai-prod`
- **Database Password**: [Generate strong password - **SAVE THIS!**]
- **Region**: **Europe West (Frankfurt)** ⚠️ (GDPR compliance)
- **Pricing Plan**: Free

**Click "Create new project"**

⏱️ Wacht ~2 minuten voor provisioning

## Stap 3: Get API Credentials

1. **Go to**: Settings → API
2. **Copy these values**:

```
Project URL: https://xxx.supabase.co
anon public key: eyJxxx...
service_role key: eyJxxx... (click "Reveal" first)
```

**SAVE THESE** - je hebt ze nodig voor Vercel en Railway!

## Stap 4: Get Database URL

1. **Go to**: Settings → Database
2. **Scroll to "Connection string"**
3. **Select**: URI
4. **Copy the URL**: `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`
5. **Replace `[YOUR-PASSWORD]`** met je database password (van stap 2)

## Stap 5: Configure Email Auth

1. **Go to**: Authentication → Providers
2. **Enable "Email"** provider
3. **Disable "Confirm email"** (voor development)
   - Later zetten we dit aan voor production

## Stap 6: Create Database Tables

1. **Go to**: SQL Editor
2. **Click "New query"**
3. **Paste this SQL**:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- Organization members (multi-tenancy)
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
```

4. **Click "Run"** (bottom right)
5. **Verify**: Go to Table Editor → You should see 3 tables ✅

---

## Stap 7: Update Vercel Environment Variables

1. **Go to**: Vercel dashboard
2. **Select**: salesprep-ai project
3. **Go to**: Settings → Environment Variables
4. **Add/Update**:

```
NEXT_PUBLIC_SUPABASE_URL = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJxxx... (anon public key)
```

5. **Redeploy**: Deployments → ... → Redeploy

---

## Stap 8: Update Railway Environment Variables

1. **Go to**: Railway dashboard
2. **Select**: salesprep-ai service
3. **Go to**: Variables tab
4. **Add/Update**:

```
SUPABASE_URL = https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJxxx... (service_role key)
DATABASE_URL = postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
```

5. **Redeploy**: Deployments → Redeploy

---

## ✅ Verification

### Test Supabase Connection

**Frontend** (Vercel URL):
- Open browser console (F12)
- Type:
```javascript
// Should not error
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
```

**Backend** (Railway URL):
- Go to: `[YOUR-RAILWAY-URL]/api/v1/test`
- Should see: `"database": "connected"` ✅

---

## 🎉 Complete Setup!

You now have:
- ✅ Frontend deployed on Vercel
- ✅ Backend deployed on Railway
- ✅ Database on Supabase
- ✅ All services connected

**Next**: Test the full stack and start building features!

# Supabase SQL Setup for Database Schema

Run this SQL in the Supabase SQL Editor to setup the core tables and security policies.

```sql
-- ==========================================
-- 1. Helper Functions
-- ==========================================

-- Function to check if current user is member of an org
create or replace function public.is_org_member(org_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from organization_members
    where organization_id = org_id
    and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- ==========================================
-- 2. Organizations & Members (Ensure existence)
-- ==========================================

create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  owner_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists organization_members (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz default now(),
  unique(organization_id, user_id)
);

-- Enable RLS
alter table organizations enable row level security;
alter table organization_members enable row level security;

-- Policies for Organizations
drop policy if exists "Members can view their organizations" on organizations;
create policy "Members can view their organizations"
  on organizations for select
  using (
    auth.uid() = owner_id or
    exists (
      select 1 from organization_members
      where organization_id = organizations.id
      and user_id = auth.uid()
    )
  );

-- Policies for Members
drop policy if exists "Members can view other members of their orgs" on organization_members;
create policy "Members can view other members of their orgs"
  on organization_members for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
      and om.user_id = auth.uid()
    )
  );

-- ==========================================
-- 3. Products
-- ==========================================

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  description text,
  url text,
  value_proposition jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table products enable row level security;

drop policy if exists "Org members can view products" on products;
create policy "Org members can view products"
  on products for select
  using ( public.is_org_member(org_id) );

drop policy if exists "Org members can insert products" on products;
create policy "Org members can insert products"
  on products for insert
  with check ( public.is_org_member(org_id) );

drop policy if exists "Org members can update products" on products;
create policy "Org members can update products"
  on products for update
  using ( public.is_org_member(org_id) );

drop policy if exists "Org members can delete products" on products;
create policy "Org members can delete products"
  on products for delete
  using ( public.is_org_member(org_id) );

-- ==========================================
-- 4. ICPs (Ideal Customer Profiles)
-- ==========================================

create table if not exists icps (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  name text not null,
  region text,
  industry text,
  company_size text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table icps enable row level security;

-- Policies (same pattern)
drop policy if exists "Org members can view icps" on icps;
create policy "Org members can view icps"
  on icps for select
  using ( public.is_org_member(org_id) );

drop policy if exists "Org members can insert icps" on icps;
create policy "Org members can insert icps"
  on icps for insert
  with check ( public.is_org_member(org_id) );

drop policy if exists "Org members can update icps" on icps;
create policy "Org members can update icps"
  on icps for update
  using ( public.is_org_member(org_id) );

drop policy if exists "Org members can delete icps" on icps;
create policy "Org members can delete icps"
  on icps for delete
  using ( public.is_org_member(org_id) );

-- ==========================================
-- 5. Personas
-- ==========================================

create table if not exists personas (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade not null,
  icp_id uuid references icps(id) on delete cascade not null,
  role text not null,
  seniority text,
  pain_points text,
  goals text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table personas enable row level security;

-- Policies
drop policy if exists "Org members can view personas" on personas;
create policy "Org members can view personas"
  on personas for select
  using ( public.is_org_member(org_id) );

drop policy if exists "Org members can insert personas" on personas;
create policy "Org members can insert personas"
  on personas for insert
  with check ( public.is_org_member(org_id) );

drop policy if exists "Org members can update personas" on personas;
create policy "Org members can update personas"
  on personas for update
  using ( public.is_org_member(org_id) );

drop policy if exists "Org members can delete personas" on personas;
create policy "Org members can delete personas"
  on personas for delete
  using ( public.is_org_member(org_id) );
```

## How to run:
1. Go to Supabase Dashboard
2. Click "SQL Editor" (left sidebar)
3. Click "New query"
4. Paste the code above
5. Click "Run"

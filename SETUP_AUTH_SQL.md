# Supabase SQL Setup for Authentication

Run this SQL in the Supabase SQL Editor to setup the `public.users` table and auto-sync trigger.

```sql
-- 1. Create public.users table (mirrors auth.users)
create table public.users (
  id uuid not null references auth.users on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id)
);

-- 2. Enable RLS
alter table public.users enable row level security;

-- 3. Create policies
create policy "Users can view own profile"
  on public.users for select
  using ( auth.uid() = id );

create policy "Users can update own profile"
  on public.users for update
  using ( auth.uid() = id );

-- 4. Create trigger function to auto-create user in public.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

-- 5. Attach trigger to auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## How to run:
1. Go to Supabase Dashboard
2. Click "SQL Editor" (left sidebar)
3. Click "New query"
4. Paste the code above
5. Click "Run"

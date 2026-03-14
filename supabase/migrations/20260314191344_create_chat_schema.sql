-- Drop existing tables if they exist (safe for fresh dev setup)
drop table if exists public.maintenance_requests cascade;
drop table if exists public.chat_messages cascade;
drop table if exists public.tenants cascade;
drop table if exists public.properties cascade;

-- Properties table (landlord seeds this, tenants reference it)
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  rent_due_day integer not null default 1,
  parking_policy text,
  pet_policy text,
  quiet_hours text,
  lease_terms text,
  manager_name text,
  manager_phone text,
  created_at timestamptz not null default now()
);

-- Tenant profiles (linked to auth.users)
create table public.tenants (
  id uuid primary key references auth.users(id),
  property_id uuid references public.properties(id),
  unit text not null,
  name text not null,
  move_in_date date,
  lease_end_date date,
  created_at timestamptz not null default now()
);

-- Chat history
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Maintenance requests (the handoff record)
create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  unit text not null,
  issue text not null,
  urgency text not null check (urgency in ('habitability', 'standard')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  created_at timestamptz not null default now()
);

-- RLS policies
alter table public.properties enable row level security;
alter table public.tenants enable row level security;
alter table public.chat_messages enable row level security;
alter table public.maintenance_requests enable row level security;

create policy "Tenants read own property" on public.properties
  for select using (id in (select property_id from public.tenants where id = auth.uid()));

create policy "Tenants read own profile" on public.tenants
  for select using (id = auth.uid());

create policy "Tenants read own messages" on public.chat_messages
  for select using (tenant_id = auth.uid());

create policy "Tenants insert own messages" on public.chat_messages
  for insert with check (tenant_id = auth.uid());

create policy "Tenants read own requests" on public.maintenance_requests
  for select using (tenant_id = auth.uid());

create policy "Tenants insert own requests" on public.maintenance_requests
  for insert with check (tenant_id = auth.uid());

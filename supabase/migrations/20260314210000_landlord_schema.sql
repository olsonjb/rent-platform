-- Extend properties table with landlord-specific columns
-- (properties table created by 20260314191344_create_chat_schema.sql)
alter table public.properties
  add column if not exists landlord_id uuid references auth.users(id) on delete cascade,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists bedrooms integer default 1,
  add column if not exists bathrooms numeric(3,1) default 1,
  add column if not exists monthly_rent numeric(10,2);

-- Landlord RLS policies on properties (tenant policies already exist)
create policy "landlord select own properties"
  on public.properties for select
  using (auth.uid() = landlord_id);

create policy "landlord insert own properties"
  on public.properties for insert
  with check (auth.uid() = landlord_id);

create policy "landlord update own properties"
  on public.properties for update
  using (auth.uid() = landlord_id);

create policy "landlord delete own properties"
  on public.properties for delete
  using (auth.uid() = landlord_id);

-- Landlord-managed tenant contacts (separate from auth-linked tenants table)
create table if not exists public.landlord_tenants (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  auth_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.landlord_tenants enable row level security;

create policy "landlord select own landlord_tenants"
  on public.landlord_tenants for select
  using (auth.uid() = landlord_id);

create policy "landlord insert own landlord_tenants"
  on public.landlord_tenants for insert
  with check (auth.uid() = landlord_id);

create policy "landlord update own landlord_tenants"
  on public.landlord_tenants for update
  using (auth.uid() = landlord_id);

create policy "landlord delete own landlord_tenants"
  on public.landlord_tenants for delete
  using (auth.uid() = landlord_id);

-- Lease status enum (idempotent)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'lease_status') then
    create type lease_status as enum ('active', 'pending', 'expired', 'terminated');
  end if;
end
$$;

-- Leases table
create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  tenant_id uuid not null references public.landlord_tenants(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  monthly_rent numeric(10,2) not null,
  status lease_status not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.leases enable row level security;

create policy "landlord select own leases"
  on public.leases for select
  using (auth.uid() = landlord_id);

create policy "landlord insert own leases"
  on public.leases for insert
  with check (auth.uid() = landlord_id);

create policy "landlord update own leases"
  on public.leases for update
  using (auth.uid() = landlord_id);

create policy "landlord delete own leases"
  on public.leases for delete
  using (auth.uid() = landlord_id);

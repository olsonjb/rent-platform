-- Properties table
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  bedrooms integer not null default 1,
  bathrooms numeric(3,1) not null default 1,
  monthly_rent numeric(10,2) not null,
  created_at timestamptz not null default now()
);

alter table properties enable row level security;

create policy "landlord select properties"
  on properties for select
  using (auth.uid() = landlord_id);

create policy "landlord insert properties"
  on properties for insert
  with check (auth.uid() = landlord_id);

create policy "landlord update properties"
  on properties for update
  using (auth.uid() = landlord_id);

create policy "landlord delete properties"
  on properties for delete
  using (auth.uid() = landlord_id);

-- Tenants table
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

alter table tenants enable row level security;

create policy "landlord select tenants"
  on tenants for select
  using (auth.uid() = landlord_id);

create policy "landlord insert tenants"
  on tenants for insert
  with check (auth.uid() = landlord_id);

create policy "landlord update tenants"
  on tenants for update
  using (auth.uid() = landlord_id);

create policy "landlord delete tenants"
  on tenants for delete
  using (auth.uid() = landlord_id);

-- Lease status enum
create type lease_status as enum ('active', 'pending', 'expired', 'terminated');

-- Leases table
create table if not exists leases (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references properties(id) on delete restrict,
  tenant_id uuid not null references tenants(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  monthly_rent numeric(10,2) not null,
  status lease_status not null default 'pending',
  created_at timestamptz not null default now()
);

alter table leases enable row level security;

create policy "landlord select leases"
  on leases for select
  using (auth.uid() = landlord_id);

create policy "landlord insert leases"
  on leases for insert
  with check (auth.uid() = landlord_id);

create policy "landlord update leases"
  on leases for update
  using (auth.uid() = landlord_id);

create policy "landlord delete leases"
  on leases for delete
  using (auth.uid() = landlord_id);

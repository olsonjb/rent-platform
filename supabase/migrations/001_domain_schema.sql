-- Add renewal_offered to leases
alter table leases add column if not exists renewal_offered boolean not null default false;

-- Add renewed value to lease_status enum (keep existing values)
alter type lease_status add value if not exists 'renewed';

-- Add sqft to properties (optional field)
alter table properties add column if not exists sqft integer;

-- Listing status enum
do $$ begin
  create type listing_status as enum ('pending', 'submitted', 'active', 'failed', 'expired');
exception when duplicate_object then null;
end $$;

-- Listings table
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  lease_id uuid not null references leases(id) on delete cascade,
  landlord_id uuid not null references auth.users(id) on delete cascade,
  title text,
  description text,
  asking_price numeric(10,2),
  available_date date,
  status listing_status not null default 'pending',
  ai_decision jsonb,
  provider_results jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table listings enable row level security;

create policy "landlord select listings"
  on listings for select
  using (auth.uid() = landlord_id);

create policy "landlord insert listings"
  on listings for insert
  with check (auth.uid() = landlord_id);

create policy "landlord update listings"
  on listings for update
  using (auth.uid() = landlord_id);

create policy "landlord delete listings"
  on listings for delete
  using (auth.uid() = landlord_id);

-- Service role bypass policies (cron uses service role)
create policy "service role all listings"
  on listings for all
  using (auth.role() = 'service_role');

create policy "service role all leases"
  on leases for all
  using (auth.role() = 'service_role');

create policy "service role all properties"
  on properties for all
  using (auth.role() = 'service_role');

-- Index for efficient cron scan
create index if not exists leases_end_date_idx
  on leases (end_date)
  where status = 'active';

-- Rent invoices table for monthly rent collection
create table if not exists public.rent_invoices (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete restrict,
  tenant_id uuid not null references public.landlord_tenants(id) on delete restrict,
  landlord_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed', 'overdue')),
  due_date date not null,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- Idempotency: one invoice per lease per month
create unique index if not exists rent_invoices_lease_month_uniq
  on public.rent_invoices (lease_id, date_trunc('month', due_date));

-- Query indexes
create index if not exists rent_invoices_tenant_id_idx
  on public.rent_invoices (tenant_id);

create index if not exists rent_invoices_landlord_id_idx
  on public.rent_invoices (landlord_id);

create index if not exists rent_invoices_status_idx
  on public.rent_invoices (status);

create index if not exists rent_invoices_due_date_idx
  on public.rent_invoices (due_date);

create index if not exists rent_invoices_status_due_date_idx
  on public.rent_invoices (status, due_date)
  where status in ('pending', 'processing');

-- RLS
alter table public.rent_invoices enable row level security;

-- Landlords see their own invoices
create policy "landlord select own rent_invoices"
  on public.rent_invoices for select
  using (auth.uid() = landlord_id);

-- Tenants see invoices for their leases (via landlord_tenants.auth_user_id)
create policy "tenant select own rent_invoices"
  on public.rent_invoices for select
  using (
    tenant_id in (
      select id from public.landlord_tenants where auth_user_id = auth.uid()
    )
  );

-- Only service role inserts/updates (cron job), no user policies needed

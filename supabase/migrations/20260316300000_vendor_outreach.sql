-- Vendor outreach: tracks SMS/email outreach to maintenance vendors
create table if not exists public.vendor_outreach (
  id uuid primary key default gen_random_uuid(),
  maintenance_request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  vendor_name text not null,
  vendor_phone text,
  vendor_email text,
  outreach_method text not null default 'sms' check (outreach_method in ('sms', 'email')),
  message_sent text not null,
  status text not null default 'sent' check (status in ('sent', 'responded', 'no_response', 'declined')),
  quote_amount_cents integer,
  quote_details text,
  vendor_availability text,
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendor_outreach_request_id_idx
  on public.vendor_outreach (maintenance_request_id);

create index if not exists vendor_outreach_vendor_phone_idx
  on public.vendor_outreach (vendor_phone)
  where vendor_phone is not null;

create index if not exists vendor_outreach_status_idx
  on public.vendor_outreach (status);

alter table public.vendor_outreach enable row level security;

-- Landlords can view outreach for their properties
create policy "landlord select vendor outreach"
  on public.vendor_outreach for select
  using (
    exists (
      select 1
      from public.maintenance_requests mr
      join public.tenants t on t.id = mr.tenant_id
      join public.properties p on p.id = t.property_id
      where mr.id = vendor_outreach.maintenance_request_id
        and p.landlord_id = auth.uid()
    )
  );

-- Landlords can update outreach for their properties (approve quotes)
create policy "landlord update vendor outreach"
  on public.vendor_outreach for update
  using (
    exists (
      select 1
      from public.maintenance_requests mr
      join public.tenants t on t.id = mr.tenant_id
      join public.properties p on p.id = t.property_id
      where mr.id = vendor_outreach.maintenance_request_id
        and p.landlord_id = auth.uid()
    )
  );

-- Auto-update updated_at on row update
create or replace function public.set_vendor_outreach_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vendor_outreach_set_updated_at on public.vendor_outreach;
create trigger vendor_outreach_set_updated_at
before update on public.vendor_outreach
for each row
execute function public.set_vendor_outreach_updated_at();

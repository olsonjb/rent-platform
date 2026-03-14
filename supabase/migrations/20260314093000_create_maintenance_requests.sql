create extension if not exists pgcrypto;

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  renter_user_id uuid not null references auth.users(id) on delete cascade,
  issue_title text not null,
  location text not null,
  urgency text not null,
  details text not null,
  entry_permission text not null,
  contact_phone text not null,
  status text not null default 'submitted',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint maintenance_requests_issue_title_not_blank check (char_length(trim(issue_title)) > 0),
  constraint maintenance_requests_details_not_blank check (char_length(trim(details)) > 0),
  constraint maintenance_requests_contact_phone_not_blank check (char_length(trim(contact_phone)) > 0),
  constraint maintenance_requests_location_check check (
    location in ('kitchen', 'bathroom', 'living-room', 'bedroom', 'hvac', 'other')
  ),
  constraint maintenance_requests_urgency_check check (urgency in ('emergency', 'high', 'normal')),
  constraint maintenance_requests_entry_permission_check check (
    entry_permission in ('can-enter', 'present-only')
  ),
  constraint maintenance_requests_status_check check (status in ('submitted', 'in_progress', 'resolved'))
);

create index if not exists maintenance_requests_renter_created_idx
  on public.maintenance_requests (renter_user_id, created_at desc);

alter table public.maintenance_requests enable row level security;

drop policy if exists "renter_select_own_maintenance_requests" on public.maintenance_requests;
create policy "renter_select_own_maintenance_requests"
  on public.maintenance_requests
  for select
  to authenticated
  using (renter_user_id = auth.uid());

drop policy if exists "renter_insert_own_maintenance_requests" on public.maintenance_requests;
create policy "renter_insert_own_maintenance_requests"
  on public.maintenance_requests
  for insert
  to authenticated
  with check (renter_user_id = auth.uid());

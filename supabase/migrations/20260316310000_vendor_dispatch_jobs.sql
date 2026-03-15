-- Vendor dispatch job queue: claim/retry pattern matching maintenance_review_jobs
create table if not exists public.vendor_dispatch_jobs (
  id uuid primary key default gen_random_uuid(),
  maintenance_request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (maintenance_request_id)
);

create index if not exists vendor_dispatch_jobs_status_next_attempt_idx
  on public.vendor_dispatch_jobs (status, next_attempt_at);

alter table public.vendor_dispatch_jobs enable row level security;

-- Auto-update updated_at
create or replace function public.set_vendor_dispatch_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vendor_dispatch_jobs_set_updated_at on public.vendor_dispatch_jobs;
create trigger vendor_dispatch_jobs_set_updated_at
before update on public.vendor_dispatch_jobs
for each row
execute function public.set_vendor_dispatch_jobs_updated_at();

-- Auto-enqueue vendor dispatch job when a maintenance_request_review is saved
create or replace function public.enqueue_vendor_dispatch_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.vendor_dispatch_jobs (maintenance_request_id)
  values (new.maintenance_request_id)
  on conflict (maintenance_request_id) do nothing;

  return new;
end;
$$;

drop trigger if exists enqueue_vendor_dispatch_on_review on public.maintenance_request_reviews;
create trigger enqueue_vendor_dispatch_on_review
after insert on public.maintenance_request_reviews
for each row
execute function public.enqueue_vendor_dispatch_job();

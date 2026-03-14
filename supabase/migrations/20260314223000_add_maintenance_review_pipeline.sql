create table if not exists public.maintenance_review_jobs (
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

create table if not exists public.maintenance_request_reviews (
  id uuid primary key default gen_random_uuid(),
  maintenance_request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  trade text not null,
  severity text not null,
  estimated_cost_min numeric(10, 2) not null,
  estimated_cost_max numeric(10, 2) not null,
  currency text not null default 'USD',
  confidence numeric(4, 3) not null,
  summary text not null,
  vendors jsonb not null default '[]'::jsonb,
  model text not null,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (maintenance_request_id)
);

create index if not exists maintenance_review_jobs_status_next_attempt_idx
  on public.maintenance_review_jobs (status, next_attempt_at);

create index if not exists maintenance_request_reviews_request_id_idx
  on public.maintenance_request_reviews (maintenance_request_id);

alter table public.maintenance_review_jobs enable row level security;
alter table public.maintenance_request_reviews enable row level security;

create policy "landlord select related tenants"
  on public.tenants for select
  using (
    exists (
      select 1
      from public.properties p
      where p.id = tenants.property_id
        and p.landlord_id = auth.uid()
    )
  );

create policy "landlord select related maintenance requests"
  on public.maintenance_requests for select
  using (
    exists (
      select 1
      from public.tenants t
      join public.properties p on p.id = t.property_id
      where t.id = maintenance_requests.tenant_id
        and p.landlord_id = auth.uid()
    )
  );

create policy "landlord select related maintenance reviews"
  on public.maintenance_request_reviews for select
  using (
    exists (
      select 1
      from public.maintenance_requests mr
      join public.tenants t on t.id = mr.tenant_id
      join public.properties p on p.id = t.property_id
      where mr.id = maintenance_request_reviews.maintenance_request_id
        and p.landlord_id = auth.uid()
    )
  );

create or replace function public.set_maintenance_review_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_maintenance_request_reviews_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists maintenance_review_jobs_set_updated_at on public.maintenance_review_jobs;
create trigger maintenance_review_jobs_set_updated_at
before update on public.maintenance_review_jobs
for each row
execute function public.set_maintenance_review_jobs_updated_at();

drop trigger if exists maintenance_request_reviews_set_updated_at on public.maintenance_request_reviews;
create trigger maintenance_request_reviews_set_updated_at
before update on public.maintenance_request_reviews
for each row
execute function public.set_maintenance_request_reviews_updated_at();

create or replace function public.enqueue_maintenance_review_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.maintenance_review_jobs (maintenance_request_id)
  values (new.id)
  on conflict (maintenance_request_id) do nothing;

  return new;
end;
$$;

drop trigger if exists enqueue_maintenance_review_job_on_insert on public.maintenance_requests;
create trigger enqueue_maintenance_review_job_on_insert
after insert on public.maintenance_requests
for each row
execute function public.enqueue_maintenance_review_job();

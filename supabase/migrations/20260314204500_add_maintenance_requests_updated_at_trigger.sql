alter table public.maintenance_requests
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_maintenance_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists maintenance_requests_set_updated_at on public.maintenance_requests;

create trigger maintenance_requests_set_updated_at
before update on public.maintenance_requests
for each row
execute function public.set_maintenance_requests_updated_at();

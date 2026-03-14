alter table public.maintenance_requests
  add column if not exists location text,
  add column if not exists details text,
  add column if not exists entry_permission text,
  add column if not exists contact_phone text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'maintenance_requests_location_check'
      and conrelid = 'public.maintenance_requests'::regclass
  ) then
    alter table public.maintenance_requests
      add constraint maintenance_requests_location_check
      check (
        location is null
        or location in ('kitchen', 'bathroom', 'living-room', 'bedroom', 'hvac', 'other')
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'maintenance_requests_entry_permission_check'
      and conrelid = 'public.maintenance_requests'::regclass
  ) then
    alter table public.maintenance_requests
      add constraint maintenance_requests_entry_permission_check
      check (
        entry_permission is null
        or entry_permission in ('can-enter', 'present-only')
      );
  end if;
end
$$;

create index if not exists maintenance_requests_tenant_created_idx
  on public.maintenance_requests (tenant_id, created_at desc);

-- Add photos array column to maintenance_requests for storing uploaded image URLs
alter table public.maintenance_requests
  add column if not exists photos text[] default '{}';

-- Tenants can update photos on their own requests (for upload after creation)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'maintenance_requests'
      and policyname = 'Tenants update own request photos'
  ) then
    create policy "Tenants update own request photos"
      on public.maintenance_requests
      for update
      using (tenant_id = auth.uid())
      with check (tenant_id = auth.uid());
  end if;
end
$$;

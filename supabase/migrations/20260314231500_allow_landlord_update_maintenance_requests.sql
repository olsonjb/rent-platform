drop policy if exists "landlord update related maintenance requests"
  on public.maintenance_requests;

create policy "landlord update related maintenance requests"
  on public.maintenance_requests for update
  using (
    exists (
      select 1
      from public.tenants t
      join public.properties p on p.id = t.property_id
      where t.id = maintenance_requests.tenant_id
        and p.landlord_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tenants t
      join public.properties p on p.id = t.property_id
      where t.id = maintenance_requests.tenant_id
        and p.landlord_id = auth.uid()
    )
  );

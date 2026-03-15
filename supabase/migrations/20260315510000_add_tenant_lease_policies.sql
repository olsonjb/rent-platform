-- Allow tenants to read their own leases via landlord_tenants.auth_user_id
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'leases'
      and policyname = 'Tenants read own leases'
  ) then
    create policy "Tenants read own leases"
      on public.leases
      for select
      using (
        tenant_id in (
          select id from public.landlord_tenants
          where auth_user_id = auth.uid()
        )
      );
  end if;
end
$$;

-- Allow tenants to read their own landlord_tenants record
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'landlord_tenants'
      and policyname = 'Tenants read own contact record'
  ) then
    create policy "Tenants read own contact record"
      on public.landlord_tenants
      for select
      using (auth_user_id = auth.uid());
  end if;
end
$$;

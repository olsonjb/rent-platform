do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and policyname = 'Tenants insert own profile'
  ) then
    create policy "Tenants insert own profile"
      on public.tenants
      for insert
      with check (id = auth.uid());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and policyname = 'Tenants update own profile'
  ) then
    create policy "Tenants update own profile"
      on public.tenants
      for update
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;
end
$$;

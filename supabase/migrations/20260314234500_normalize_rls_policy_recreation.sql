-- Normalize policy creation so migration replay is always safe.

drop policy if exists "landlord select own properties" on public.properties;
create policy "landlord select own properties"
  on public.properties for select
  using (auth.uid() = landlord_id);

drop policy if exists "landlord insert own properties" on public.properties;
create policy "landlord insert own properties"
  on public.properties for insert
  with check (auth.uid() = landlord_id);

drop policy if exists "landlord update own properties" on public.properties;
create policy "landlord update own properties"
  on public.properties for update
  using (auth.uid() = landlord_id);

drop policy if exists "landlord delete own properties" on public.properties;
create policy "landlord delete own properties"
  on public.properties for delete
  using (auth.uid() = landlord_id);

drop policy if exists "landlord select own landlord_tenants" on public.landlord_tenants;
create policy "landlord select own landlord_tenants"
  on public.landlord_tenants for select
  using (auth.uid() = landlord_id);

drop policy if exists "landlord insert own landlord_tenants" on public.landlord_tenants;
create policy "landlord insert own landlord_tenants"
  on public.landlord_tenants for insert
  with check (auth.uid() = landlord_id);

drop policy if exists "landlord update own landlord_tenants" on public.landlord_tenants;
create policy "landlord update own landlord_tenants"
  on public.landlord_tenants for update
  using (auth.uid() = landlord_id);

drop policy if exists "landlord delete own landlord_tenants" on public.landlord_tenants;
create policy "landlord delete own landlord_tenants"
  on public.landlord_tenants for delete
  using (auth.uid() = landlord_id);

drop policy if exists "landlord select own leases" on public.leases;
create policy "landlord select own leases"
  on public.leases for select
  using (auth.uid() = landlord_id);

drop policy if exists "landlord insert own leases" on public.leases;
create policy "landlord insert own leases"
  on public.leases for insert
  with check (auth.uid() = landlord_id);

drop policy if exists "landlord update own leases" on public.leases;
create policy "landlord update own leases"
  on public.leases for update
  using (auth.uid() = landlord_id);

drop policy if exists "landlord delete own leases" on public.leases;
create policy "landlord delete own leases"
  on public.leases for delete
  using (auth.uid() = landlord_id);

drop policy if exists "landlord select related tenants" on public.tenants;
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

drop policy if exists "landlord select related maintenance requests" on public.maintenance_requests;
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

drop policy if exists "landlord select related maintenance reviews" on public.maintenance_request_reviews;
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

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can view own payments" on public.payments;
create policy "Users can view own payments"
  on public.payments for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own payments" on public.payments;
create policy "Users can insert own payments"
  on public.payments for insert
  with check (auth.uid() = user_id);

-- Profiles table: one row per auth.users, stores Stripe customer ID
create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  stripe_customer_id text unique,
  created_at         timestamptz default now()
);
alter table public.profiles enable row level security;

-- Users may read their own profile
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

-- Users may create their own profile row on first sign-in
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Users may update their own profile (server actions run as authenticated user)
-- stripe_customer_id is set server-side; no column-level restriction needed here
-- because the server action always uses the authenticated user's own row.
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Payments table: one row per Checkout session
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id  text,
  stripe_checkout_id  text unique,
  amount              integer,          -- cents
  currency            text default 'usd',
  status              text default 'pending' check (status in ('pending','succeeded','failed')),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
alter table public.payments enable row level security;

-- Users may read their own payment records
create policy "Users can view own payments"
  on public.payments for select using (auth.uid() = user_id);

-- Users may insert their own payment records (server action creates 'pending' row)
create policy "Users can insert own payments"
  on public.payments for insert with check (auth.uid() = user_id);

-- No UPDATE policy for regular users: only the service-role webhook handler may
-- update payment status.  Service role bypasses RLS, so no explicit policy needed.

-- No DELETE policy: payment records are immutable audit entries.

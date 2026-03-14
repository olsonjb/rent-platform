-- Extend profiles for setup-mode Stripe (authorize now, charge later)
alter table public.profiles
  add column if not exists payment_status text default 'none'
    check (payment_status in ('none','demo_trial','authorized','active')),
  add column if not exists trial_ends_at timestamptz,
  add column if not exists stripe_setup_intent_id text,
  add column if not exists stripe_payment_method_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists total_monthly_rent integer default 0;  -- cents

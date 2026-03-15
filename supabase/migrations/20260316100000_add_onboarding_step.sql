-- Add onboarding_step to profiles table to track wizard progress
alter table public.profiles
  add column if not exists onboarding_step text not null default 'profile';

-- Enforce valid step values
alter table public.profiles
  add constraint profiles_onboarding_step_check
  check (onboarding_step in ('profile', 'add_property', 'add_tenant', 'create_lease', 'setup_payment', 'complete'));

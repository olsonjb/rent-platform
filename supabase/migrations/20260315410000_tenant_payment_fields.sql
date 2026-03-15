-- Add payment method metadata to profiles for tenant rent payments
-- (stripe_customer_id and stripe_payment_method_id already exist from setup-mode migration)
alter table public.profiles
  add column if not exists payment_method_type text,
  add column if not exists payment_method_last4 text;

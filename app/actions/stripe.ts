'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStripe, getStripeMode } from '@/lib/stripe';

/**
 * Ensure a Stripe customer exists for the current user. Returns the customer ID.
 */
async function ensureStripeCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email?: string,
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  let stripeCustomerId = profile?.stripe_customer_id ?? null;

  if (!stripeCustomerId) {
    const customer = await getStripe().customers.create({
      email,
      metadata: { supabase_user_id: userId },
    });

    const { data: updated } = await supabase
      .from('profiles')
      .update({ stripe_customer_id: customer.id })
      .eq('id', userId)
      .is('stripe_customer_id', null)
      .select('stripe_customer_id')
      .single();

    stripeCustomerId = updated?.stripe_customer_id ?? customer.id;
  }

  return stripeCustomerId;
}

/**
 * Get total monthly rent (in cents) across all active leases for a landlord.
 */
async function getTotalMonthlyRent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<number> {
  const { data: leases } = await supabase
    .from('leases')
    .select('monthly_rent')
    .eq('landlord_id', userId)
    .eq('status', 'active');

  if (!leases || leases.length === 0) return 0;

  const totalDollars = leases.reduce((sum, l) => sum + Number(l.monthly_rent), 0);
  return Math.round(totalDollars * 100); // convert to cents
}

/**
 * Create a Stripe Checkout session in setup mode — authorizes card, does not charge.
 * The 3% fee will be charged monthly once rent collection begins.
 */
export async function createSetupCheckoutSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  await supabase
    .from('profiles')
    .upsert({ id: user.id, email: user.email }, { onConflict: 'id' });

  const stripeCustomerId = await ensureStripeCustomer(supabase, user.id, user.email);
  const totalRentCents = await getTotalMonthlyRent(supabase, user.id);

  await supabase
    .from('profiles')
    .update({ total_monthly_rent: totalRentCents })
    .eq('id', user.id);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const session = await getStripe().checkout.sessions.create({
    mode: 'setup',
    customer: stripeCustomerId,
    client_reference_id: user.id,
    success_url: `${baseUrl}/protected/onboarding?status=authorized`,
    cancel_url: `${baseUrl}/protected/onboarding?status=cancelled`,
    metadata: {
      supabase_user_id: user.id,
      total_monthly_rent_cents: String(totalRentCents),
      fee_percent: '3',
    },
  });

  if (!session.url) {
    throw new Error('Stripe returned an invalid session — missing url');
  }

  redirect(session.url);
}

/**
 * Activate the 30-day demo trial — no payment method required.
 */
export async function activateDemoTrial() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);

  await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email,
      payment_status: 'demo_trial',
      trial_ends_at: trialEnd.toISOString(),
    },
    { onConflict: 'id' },
  );

  redirect('/landlord/dashboard');
}

/**
 * Get the current landlord's payment/onboarding status.
 */
export async function getOnboardingStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('payment_status, trial_ends_at, total_monthly_rent')
    .eq('id', user.id)
    .single();

  const totalRentCents = await getTotalMonthlyRent(supabase, user.id);
  const feeCents = Math.round(totalRentCents * 0.03);

  return {
    paymentStatus: profile?.payment_status ?? 'none',
    trialEndsAt: profile?.trial_ends_at ?? null,
    totalMonthlyRentCents: totalRentCents,
    monthlyFeeCents: feeCents,
  };
}

'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export async function createCheckoutSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Upsert profile row (email kept in sync on every call)
  await supabase.from('profiles').upsert(
    { id: user.id, email: user.email },
    { onConflict: 'id' }
  );

  // Fetch profile — may already have a Stripe customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  let stripeCustomerId = profile?.stripe_customer_id ?? null;

  if (!stripeCustomerId) {
    // Re-fetch with a short circuit to guard against a concurrent request that
    // already created the customer between our read and this write.
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });

    const { data: updated } = await supabase
      .from('profiles')
      .update({ stripe_customer_id: customer.id })
      .eq('id', user.id)
      // Only write if another request hasn't already set it
      .is('stripe_customer_id', null)
      .select('stripe_customer_id')
      .single();

    // If the conditional update missed (race), read whatever is now stored
    stripeCustomerId = updated?.stripe_customer_id ?? customer.id;
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  // Create Stripe Checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: stripeCustomerId,
    client_reference_id: user.id,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: 999, // $9.99
          product_data: {
            name: 'Property Listing',
            description: 'Auto PM — property listing fee',
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/protected/payments?status=success`,
    cancel_url: `${baseUrl}/protected/payments?status=cancelled`,
  });

  if (!session.url || session.amount_total === null) {
    throw new Error('Stripe returned an invalid session — missing url or amount');
  }

  // Insert pending payment record; fail fast so we don't redirect on DB error
  const { error: insertError } = await supabase.from('payments').insert({
    user_id: user.id,
    stripe_customer_id: stripeCustomerId,
    stripe_checkout_id: session.id,
    amount: session.amount_total,
    currency: 'usd',
    status: 'pending',
  });

  if (insertError) {
    throw new Error(`Failed to record payment: ${insertError.message}`);
  }

  // redirect() throws NEXT_REDIRECT — must not be inside a try/catch
  redirect(session.url);
}

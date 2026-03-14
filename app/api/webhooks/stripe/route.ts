import { NextRequest, NextResponse } from 'next/server';
import { stripe, stripeMode } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/service';

const WEBHOOK_SECRETS = {
  demo: process.env.STRIPE_TEST_WEBHOOK_SECRET,
  monetize: process.env.STRIPE_LIVE_WEBHOOK_SECRET,
} as const;

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const webhookSecret = WEBHOOK_SECRETS[stripeMode];
  if (!webhookSecret) {
    const varName =
      stripeMode === 'demo' ? 'STRIPE_TEST_WEBHOOK_SECRET' : 'STRIPE_LIVE_WEBHOOK_SECRET';
    console.error(`${varName} is not configured`);
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;

  try {
    const body = Buffer.from(await req.bytes());
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error(
      'Webhook signature verification failed:',
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Handle setup mode — card authorized, not charged
    if (session.mode === 'setup') {
      const userId = session.client_reference_id ?? session.metadata?.supabase_user_id;
      const setupIntentId =
        typeof session.setup_intent === 'string' ? session.setup_intent : null;

      if (!userId) {
        console.error('No user ID found in setup session');
        return NextResponse.json({ error: 'Missing user reference' }, { status: 400 });
      }

      let paymentMethodId: string | null = null;
      if (setupIntentId) {
        const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
        paymentMethodId =
          typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : null;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          payment_status: 'authorized',
          stripe_setup_intent_id: setupIntentId,
          stripe_payment_method_id: paymentMethodId,
        })
        .eq('id', userId);

      if (error) {
        console.error('Failed to update profile payment status:', error);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      return NextResponse.json({ received: true });
    }

    // Handle one-time payment sessions
    const customerId = typeof session.customer === 'string' ? session.customer : null;

    const { data: existing } = await supabase
      .from('payments')
      .select('status')
      .eq('stripe_checkout_id', session.id)
      .single();

    if (existing?.status === 'succeeded') {
      return NextResponse.json({ received: true });
    }

    const { error } = await supabase
      .from('payments')
      .update({
        status: 'succeeded',
        amount: session.amount_total,
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_checkout_id', session.id);

    if (error) {
      console.error('Failed to update payment record:', error);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

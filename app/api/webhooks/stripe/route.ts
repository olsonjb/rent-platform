import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;

  try {
    const body = Buffer.from(await req.bytes());
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // Log server-side for debugging; return generic message to caller
    console.error('Webhook signature verification failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const supabase = createServiceClient();

    // Resolve customer — Stripe may return a string ID or an expanded object
    const customerId = typeof session.customer === 'string' ? session.customer : null;

    // Idempotency: skip if already succeeded (Stripe retries webhooks on non-2xx)
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

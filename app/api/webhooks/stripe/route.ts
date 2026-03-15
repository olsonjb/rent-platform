import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getStripeMode } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger, withCorrelationId } from '@/lib/logger';
import { getCorrelationId, setCorrelationIdHeader } from '@/lib/correlation';
import {
  rateLimit,
  RATE_LIMIT_CONFIGS,
  shouldBypass,
  rateLimitHeaders,
} from '@/lib/rate-limit';

const baseLogger = createLogger('stripe-webhook');

const WEBHOOK_SECRETS = {
  demo: process.env.STRIPE_TEST_WEBHOOK_SECRET,
  monetize: process.env.STRIPE_LIVE_WEBHOOK_SECRET,
} as const;

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const logger = withCorrelationId(baseLogger, correlationId);

  // Rate limiting: 30 requests per minute per IP
  if (!shouldBypass(req.headers)) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown';
    const rlResult = await rateLimit(
      `stripe:${ip}`,
      RATE_LIMIT_CONFIGS.stripe,
    );

    if (!rlResult.allowed) {
      const rlHeaders = rateLimitHeaders(rlResult, RATE_LIMIT_CONFIGS.stripe);
      return setCorrelationIdHeader(
        new NextResponse(
          JSON.stringify({ error: 'Rate limit exceeded' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              ...rlHeaders,
            },
          },
        ),
        correlationId,
      );
    }
  }

  const stripe = getStripe();
  const mode = getStripeMode();

  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return setCorrelationIdHeader(
      NextResponse.json({ error: 'Bad request' }, { status: 400 }),
      correlationId,
    );
  }

  const webhookSecret = WEBHOOK_SECRETS[mode];
  if (!webhookSecret) {
    const varName =
      mode === 'demo' ? 'STRIPE_TEST_WEBHOOK_SECRET' : 'STRIPE_LIVE_WEBHOOK_SECRET';
    logger.error({ varName }, 'Stripe webhook secret is not configured');
    return setCorrelationIdHeader(
      NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 }),
      correlationId,
    );
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;

  try {
    const body = Buffer.from(await req.bytes());
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : err },
      'Webhook signature verification failed',
    );
    return setCorrelationIdHeader(
      NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 }),
      correlationId,
    );
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
        logger.error({ sessionId: session.id }, 'No user ID found in setup session');
        return setCorrelationIdHeader(
          NextResponse.json({ error: 'Missing user reference' }, { status: 400 }),
          correlationId,
        );
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
        logger.error({ err: error }, 'Failed to update profile payment status');
        return setCorrelationIdHeader(
          NextResponse.json({ error: 'Database update failed' }, { status: 500 }),
          correlationId,
        );
      }

      return setCorrelationIdHeader(
        NextResponse.json({ received: true }),
        correlationId,
      );
    }

    // Handle one-time payment sessions
    const customerId = typeof session.customer === 'string' ? session.customer : null;

    const { data: existing } = await supabase
      .from('payments')
      .select('status')
      .eq('stripe_checkout_id', session.id)
      .single();

    if (existing?.status === 'succeeded') {
      return setCorrelationIdHeader(
        NextResponse.json({ received: true }),
        correlationId,
      );
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
      logger.error({ err: error }, 'Failed to update payment record');
      return setCorrelationIdHeader(
        NextResponse.json({ error: 'Database update failed' }, { status: 500 }),
        correlationId,
      );
    }
  }

  return setCorrelationIdHeader(
    NextResponse.json({ received: true }),
    correlationId,
  );
}

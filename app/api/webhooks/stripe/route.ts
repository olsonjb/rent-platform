import { NextRequest } from 'next/server';
import { getStripe, getStripeMode } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/service';
import { apiSuccess, apiError } from '@/lib/api-response';
import { createLogger, withCorrelationId } from '@/lib/logger';
import { getCorrelationId } from '@/lib/correlation';

const baseLogger = createLogger('stripe-webhook');

const WEBHOOK_SECRETS = {
  demo: process.env.STRIPE_TEST_WEBHOOK_SECRET,
  monetize: process.env.STRIPE_LIVE_WEBHOOK_SECRET,
} as const;

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const logger = withCorrelationId(baseLogger, correlationId);

  const stripe = getStripe();
  const mode = getStripeMode();

  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return apiError('Bad request', 400, correlationId, 'MISSING_SIGNATURE');
  }

  const webhookSecret = WEBHOOK_SECRETS[mode];
  if (!webhookSecret) {
    const varName =
      mode === 'demo' ? 'STRIPE_TEST_WEBHOOK_SECRET' : 'STRIPE_LIVE_WEBHOOK_SECRET';
    logger.error({ varName }, 'Stripe webhook secret is not configured');
    return apiError('Server misconfiguration', 500, correlationId, 'MISSING_CONFIG');
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
    return apiError('Webhook verification failed', 400, correlationId, 'INVALID_SIGNATURE');
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
        return apiError('Missing user reference', 400, correlationId, 'MISSING_USER_REF');
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
        return apiError('Database update failed', 500, correlationId, 'DB_ERROR');
      }

      return apiSuccess({ received: true }, correlationId);
    }

    // Handle one-time payment sessions
    const customerId = typeof session.customer === 'string' ? session.customer : null;

    const { data: existing } = await supabase
      .from('payments')
      .select('status')
      .eq('stripe_checkout_id', session.id)
      .single();

    if (existing?.status === 'succeeded') {
      return apiSuccess({ received: true }, correlationId);
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
      return apiError('Database update failed', 500, correlationId, 'DB_ERROR');
    }
  }

  return apiSuccess({ received: true }, correlationId);
}

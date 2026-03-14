import Stripe from 'stripe';

export type StripeMode = 'demo' | 'monetize';

const raw = process.env.STRIPE_MODE;
if (raw !== 'demo' && raw !== 'monetize') {
  throw new Error(`STRIPE_MODE must be 'demo' or 'monetize', got: '${raw ?? '(unset)'}'`);
}

export const stripeMode: StripeMode = raw;

const secretKey =
  stripeMode === 'demo'
    ? process.env.STRIPE_TEST_SECRET_KEY
    : process.env.STRIPE_LIVE_SECRET_KEY;

if (!secretKey) {
  const varName = stripeMode === 'demo' ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_LIVE_SECRET_KEY';
  throw new Error(`Missing ${varName}`);
}

export const stripe = new Stripe(secretKey, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});

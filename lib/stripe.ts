import Stripe from 'stripe';

export type StripeMode = 'demo' | 'monetize';

function resolveMode(): StripeMode {
  const raw = process.env.STRIPE_MODE;
  if (raw !== 'demo' && raw !== 'monetize') {
    throw new Error(`STRIPE_MODE must be 'demo' or 'monetize', got: '${raw ?? '(unset)'}'`);
  }
  return raw;
}

let _mode: StripeMode | undefined;
let _stripe: Stripe | undefined;

/** Current Stripe mode — resolved lazily so builds don't crash when env vars are missing. */
export function getStripeMode(): StripeMode {
  if (!_mode) _mode = resolveMode();
  return _mode;
}

/** Stripe SDK client — resolved lazily so builds don't crash when env vars are missing. */
export function getStripe(): Stripe {
  if (!_stripe) {
    const mode = getStripeMode();
    const secretKey =
      mode === 'demo'
        ? process.env.STRIPE_TEST_SECRET_KEY
        : process.env.STRIPE_LIVE_SECRET_KEY;

    if (!secretKey) {
      const varName = mode === 'demo' ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_LIVE_SECRET_KEY';
      throw new Error(`Missing ${varName}`);
    }

    _stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
  }
  return _stripe;
}

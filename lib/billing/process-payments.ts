import { createServiceClient } from '@/lib/supabase/service';
import { getStripe } from '@/lib/stripe';
import { createLogger } from '@/lib/logger';

const logger = createLogger('billing-process-payments');

export interface PaymentResult {
  invoiceId: string;
  success: boolean;
  error?: string;
  paymentIntentId?: string;
}

/**
 * Process all pending invoices whose due_date <= today.
 * Creates a Stripe PaymentIntent for each using the tenant's saved payment method.
 * Updates invoice status based on the result.
 */
export async function processScheduledPayments(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  results: PaymentResult[];
}> {
  const supabase = createServiceClient();
  const stripe = getStripe();
  const today = new Date().toISOString().split('T')[0];

  // Fetch pending invoices due today or earlier
  const { data: invoices, error: fetchError } = await supabase
    .from('rent_invoices')
    .select('*')
    .eq('status', 'pending')
    .lte('due_date', today);

  if (fetchError) {
    logger.error({ err: fetchError }, 'Failed to fetch pending invoices');
    throw new Error(`Failed to fetch pending invoices: ${fetchError.message}`);
  }

  if (!invoices || invoices.length === 0) {
    logger.info('No pending invoices to process');
    return { processed: 0, succeeded: 0, failed: 0, results: [] };
  }

  const results: PaymentResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const invoice of invoices) {
    // Mark as processing
    await supabase
      .from('rent_invoices')
      .update({ status: 'processing' })
      .eq('id', invoice.id);

    // Look up tenant's auth_user_id to find their payment method
    const { data: tenant } = await supabase
      .from('landlord_tenants')
      .select('auth_user_id')
      .eq('id', invoice.tenant_id)
      .single();

    if (!tenant?.auth_user_id) {
      logger.warn({ invoiceId: invoice.id, tenantId: invoice.tenant_id }, 'Tenant has no auth user linked');
      await supabase
        .from('rent_invoices')
        .update({ status: 'failed' })
        .eq('id', invoice.id);
      results.push({ invoiceId: invoice.id, success: false, error: 'No auth user linked to tenant' });
      failed++;
      continue;
    }

    // Get tenant's payment profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, stripe_payment_method_id')
      .eq('id', tenant.auth_user_id)
      .single();

    if (!profile?.stripe_customer_id || !profile?.stripe_payment_method_id) {
      logger.warn({ invoiceId: invoice.id, tenantId: invoice.tenant_id }, 'Tenant has no payment method on file');
      await supabase
        .from('rent_invoices')
        .update({ status: 'failed' })
        .eq('id', invoice.id);
      results.push({ invoiceId: invoice.id, success: false, error: 'No payment method on file' });
      failed++;
      continue;
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: invoice.amount_cents,
        currency: 'usd',
        customer: profile.stripe_customer_id,
        payment_method: profile.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        metadata: {
          invoice_id: invoice.id,
          lease_id: invoice.lease_id,
          platform_fee_cents: String(invoice.platform_fee_cents),
        },
      });

      await supabase
        .from('rent_invoices')
        .update({
          status: 'succeeded',
          stripe_payment_intent_id: paymentIntent.id,
          paid_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      results.push({ invoiceId: invoice.id, success: true, paymentIntentId: paymentIntent.id });
      succeeded++;
      logger.info({ invoiceId: invoice.id, paymentIntentId: paymentIntent.id }, 'Payment succeeded');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown payment error';
      logger.error({ err, invoiceId: invoice.id }, 'Payment failed');

      await supabase
        .from('rent_invoices')
        .update({ status: 'failed' })
        .eq('id', invoice.id);

      results.push({ invoiceId: invoice.id, success: false, error: message });
      failed++;
    }
  }

  logger.info({ processed: invoices.length, succeeded, failed }, 'Payment processing complete');
  return { processed: invoices.length, succeeded, failed, results };
}

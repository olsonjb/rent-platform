import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import type { RentInvoice } from '@/lib/types';

const logger = createLogger('billing-invoices');

const PLATFORM_FEE_RATE = 0.03;

/** Calculate platform fee in cents (3% of rent). */
export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * PLATFORM_FEE_RATE);
}

/**
 * Generate monthly invoices for all active leases.
 * Idempotent: uses ON CONFLICT DO NOTHING on (lease_id, month).
 * Returns the number of invoices created.
 */
export async function generateMonthlyInvoices(): Promise<{ created: number; skipped: number }> {
  const supabase = createServiceClient();

  // Find all active leases
  const { data: leases, error: leasesError } = await supabase
    .from('leases')
    .select('id, landlord_id, tenant_id, monthly_rent, property_id')
    .eq('status', 'active');

  if (leasesError) {
    logger.error({ err: leasesError }, 'Failed to fetch active leases');
    throw new Error(`Failed to fetch active leases: ${leasesError.message}`);
  }

  if (!leases || leases.length === 0) {
    logger.info('No active leases found');
    return { created: 0, skipped: 0 };
  }

  // Current month's due date (1st of this month)
  const now = new Date();
  const dueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .split('T')[0];

  let created = 0;
  let skipped = 0;

  for (const lease of leases) {
    const amountCents = Math.round(Number(lease.monthly_rent) * 100);
    const platformFeeCents = calculatePlatformFee(amountCents);

    const { data, error } = await supabase
      .from('rent_invoices')
      .upsert(
        {
          lease_id: lease.id,
          tenant_id: lease.tenant_id,
          landlord_id: lease.landlord_id,
          amount_cents: amountCents,
          platform_fee_cents: platformFeeCents,
          status: 'pending',
          due_date: dueDate,
        },
        { onConflict: 'lease_id,due_date', ignoreDuplicates: true },
      )
      .select('id');

    if (error) {
      logger.warn({ err: error, leaseId: lease.id }, 'Failed to create invoice for lease');
      skipped++;
      continue;
    }

    if (data && data.length > 0) {
      created++;
    } else {
      skipped++;
    }
  }

  logger.info({ created, skipped, total: leases.length }, 'Invoice generation complete');
  return { created, skipped };
}

/** Fetch invoices for a landlord, ordered by due_date desc. */
export async function getInvoicesForLandlord(landlordId: string): Promise<RentInvoice[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('rent_invoices')
    .select('*')
    .eq('landlord_id', landlordId)
    .order('due_date', { ascending: false });

  if (error) {
    logger.error({ err: error, landlordId }, 'Failed to fetch landlord invoices');
    throw new Error(`Failed to fetch invoices: ${error.message}`);
  }

  return (data ?? []) as RentInvoice[];
}

/** Fetch invoices for a tenant (by tenant record id), ordered by due_date desc. */
export async function getInvoicesForTenant(tenantId: string): Promise<RentInvoice[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('rent_invoices')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: false });

  if (error) {
    logger.error({ err: error, tenantId }, 'Failed to fetch tenant invoices');
    throw new Error(`Failed to fetch invoices: ${error.message}`);
  }

  return (data ?? []) as RentInvoice[];
}

import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const logger = createLogger('billing-reminders');

export interface UpcomingPayment {
  invoiceId: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string | null;
  amountCents: number;
  dueDate: string;
  propertyAddress: string;
}

/**
 * Get tenants with payments due within the next N days.
 * Used by future SMS reminder integration.
 */
export async function getUpcomingPayments(daysAhead: number): Promise<UpcomingPayment[]> {
  const supabase = createServiceClient();

  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + daysAhead);
  const futureDateStr = futureDate.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const { data: invoices, error } = await supabase
    .from('rent_invoices')
    .select(`
      id,
      tenant_id,
      amount_cents,
      due_date,
      lease_id
    `)
    .eq('status', 'pending')
    .gte('due_date', todayStr)
    .lte('due_date', futureDateStr);

  if (error) {
    logger.error({ err: error }, 'Failed to fetch upcoming payments');
    throw new Error(`Failed to fetch upcoming payments: ${error.message}`);
  }

  if (!invoices || invoices.length === 0) {
    return [];
  }

  const results: UpcomingPayment[] = [];

  for (const invoice of invoices) {
    // Get tenant info
    const { data: tenant } = await supabase
      .from('landlord_tenants')
      .select('name, email, phone')
      .eq('id', invoice.tenant_id)
      .single();

    // Get property address via lease
    const { data: lease } = await supabase
      .from('leases')
      .select('property_id')
      .eq('id', invoice.lease_id)
      .single();

    let propertyAddress = 'Unknown';
    if (lease) {
      const { data: property } = await supabase
        .from('properties')
        .select('address')
        .eq('id', lease.property_id)
        .single();
      if (property) {
        propertyAddress = property.address;
      }
    }

    if (tenant) {
      results.push({
        invoiceId: invoice.id,
        tenantId: invoice.tenant_id,
        tenantName: tenant.name,
        tenantEmail: tenant.email,
        tenantPhone: tenant.phone ?? null,
        amountCents: invoice.amount_cents,
        dueDate: invoice.due_date,
        propertyAddress,
      });
    }
  }

  logger.info({ count: results.length, daysAhead }, 'Fetched upcoming payments');
  return results;
}

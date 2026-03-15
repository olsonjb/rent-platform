import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { evaluateTenantForRenewal } from '@/lib/agent/renewal-agent';
import { apiSuccess, apiError } from '@/lib/api-response';
import { createLogger, withCorrelationId } from '@/lib/logger';
import { getCorrelationId } from '@/lib/correlation';

const baseLogger = createLogger('cron-check-renewals');

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const logger = withCorrelationId(baseLogger, correlationId);

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return apiError('Unauthorized', 401, correlationId, 'UNAUTHORIZED');
  }

  try {
    const supabase = createServiceClient();

    // Find active leases expiring in 45-60 days
    const now = new Date();
    const fortyFiveDays = new Date(now);
    fortyFiveDays.setDate(fortyFiveDays.getDate() + 45);
    const sixtyDays = new Date(now);
    sixtyDays.setDate(sixtyDays.getDate() + 60);

    const { data: expiringLeases, error: queryError } = await supabase
      .from('leases')
      .select('id, landlord_id, tenant_id, end_date, monthly_rent')
      .eq('status', 'active')
      .gte('end_date', fortyFiveDays.toISOString().split('T')[0])
      .lte('end_date', sixtyDays.toISOString().split('T')[0]);

    if (queryError) {
      logger.error({ err: queryError }, 'Failed to query expiring leases');
      return apiError('Failed to query leases', 500, correlationId);
    }

    if (!expiringLeases || expiringLeases.length === 0) {
      return apiSuccess({ processed: 0, results: [] }, correlationId);
    }

    const results: { leaseId: string; recommendation: string; suggestedRent: number; error?: string }[] = [];

    for (const lease of expiringLeases) {
      try {
        // Check if renewal offer already exists for this lease
        const { data: existingOffer } = await supabase
          .from('renewal_offers')
          .select('id')
          .eq('lease_id', lease.id)
          .in('status', ['pending', 'accepted'])
          .limit(1);

        if (existingOffer && existingOffer.length > 0) {
          continue; // Skip — already has an offer
        }

        // Evaluate tenant
        const evaluation = await evaluateTenantForRenewal(lease.id);

        // Calculate new end date (1 year from current end)
        const newEndDate = new Date(lease.end_date);
        newEndDate.setFullYear(newEndDate.getFullYear() + 1);

        // Store evaluation as a renewal offer for landlord review (NOT sent yet)
        const { error: insertError } = await supabase.from('renewal_offers').insert({
          lease_id: lease.id,
          tenant_id: lease.tenant_id,
          landlord_id: lease.landlord_id,
          new_monthly_rent: evaluation.suggested_rent,
          new_end_date: newEndDate.toISOString().split('T')[0],
          status: 'pending',
          ai_recommendation: evaluation.recommendation,
          ai_reasoning: evaluation.reasoning,
          suggested_rent_adjustment: evaluation.suggested_rent - lease.monthly_rent,
        });

        if (insertError) {
          logger.error({ leaseId: lease.id, err: insertError }, 'Failed to insert renewal offer');
          results.push({
            leaseId: lease.id,
            recommendation: evaluation.recommendation,
            suggestedRent: evaluation.suggested_rent,
            error: insertError.message,
          });
          continue;
        }

        results.push({
          leaseId: lease.id,
          recommendation: evaluation.recommendation,
          suggestedRent: evaluation.suggested_rent,
        });
      } catch (err) {
        logger.error({ leaseId: lease.id, err }, 'Error evaluating lease for renewal');
        results.push({
          leaseId: lease.id,
          recommendation: 'error',
          suggestedRent: 0,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return apiSuccess({ processed: results.length, results }, correlationId);
  } catch (error) {
    logger.error({ err: error }, 'Renewal check cron error');
    return apiError(
      error instanceof Error ? error.message : 'Internal error',
      500,
      correlationId,
    );
  }
}

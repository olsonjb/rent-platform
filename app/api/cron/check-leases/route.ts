import { NextRequest } from 'next/server';
import { runListingAgent } from '@/lib/agent/listing-agent';
import { apiSuccess, apiError } from '@/lib/api-response';
import { createLogger, withCorrelationId } from '@/lib/logger';
import { getCorrelationId } from '@/lib/correlation';

const baseLogger = createLogger('cron-check-leases');

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const logger = withCorrelationId(baseLogger, correlationId);

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return apiError('Unauthorized', 401, correlationId, 'UNAUTHORIZED');
  }

  try {
    const results = await runListingAgent();
    return apiSuccess(
      {
        processed: results.length,
        results: results.map((r) => ({
          leaseId: r.leaseId,
          property: r.propertyAddress,
          shouldList: r.decision.should_list,
          listingId: r.listingId ?? null,
          providers: r.providerResults?.map((p) => ({
            name: p.provider,
            success: p.success,
            url: p.listingUrl,
          })),
        })),
      },
      correlationId,
    );
  } catch (error) {
    logger.error({ err: error }, 'Listing agent error');
    return apiError(
      error instanceof Error ? error.message : 'Internal error',
      500,
      correlationId,
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { runListingAgent } from '@/lib/agent/listing-agent';
import { createLogger, withCorrelationId } from '@/lib/logger';
import { getCorrelationId, setCorrelationIdHeader } from '@/lib/correlation';

const baseLogger = createLogger('cron-check-leases');

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const logger = withCorrelationId(baseLogger, correlationId);

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runListingAgent();
    return setCorrelationIdHeader(
      NextResponse.json({
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
      }),
      correlationId,
    );
  } catch (error) {
    logger.error({ err: error }, 'Listing agent error');
    return setCorrelationIdHeader(
      NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal error' },
        { status: 500 },
      ),
      correlationId,
    );
  }
}

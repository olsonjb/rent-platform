import { NextRequest, NextResponse } from 'next/server';
import { runListingAgent } from '@/lib/agent/listing-agent';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runListingAgent();
    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Listing agent error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCorrelationId, setCorrelationIdHeader } from '@/lib/correlation';
import {
  rateLimit,
  RATE_LIMIT_CONFIGS,
  shouldBypass,
  rateLimitHeaders,
} from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  // Rate limiting: 60 requests per minute per IP
  let rlHeaders: Record<string, string> = {};
  if (!shouldBypass(request.headers)) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown';
    const rlResult = await rateLimit(
      `listings:${ip}`,
      RATE_LIMIT_CONFIGS.listings,
    );
    rlHeaders = rateLimitHeaders(rlResult, RATE_LIMIT_CONFIGS.listings);

    if (!rlResult.allowed) {
      return setCorrelationIdHeader(
        new NextResponse(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              ...rlHeaders,
            },
          },
        ),
        correlationId,
      );
    }
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('listings')
    .select('*, properties(address, city, state, zip), leases(end_date, monthly_rent, landlord_tenants(name, email))')
    .order('created_at', { ascending: false });

  if (error) {
    return setCorrelationIdHeader(
      NextResponse.json({ error: error.message }, { status: 500 }),
      correlationId,
    );
  }

  const response = NextResponse.json(data);
  for (const [k, v] of Object.entries(rlHeaders)) {
    response.headers.set(k, v);
  }
  return setCorrelationIdHeader(response, correlationId);
}

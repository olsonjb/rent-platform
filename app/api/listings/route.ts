import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCorrelationId, setCorrelationIdHeader } from '@/lib/correlation';

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
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

  return setCorrelationIdHeader(NextResponse.json(data), correlationId);
}

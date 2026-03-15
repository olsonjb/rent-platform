import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCorrelationId, setCorrelationIdHeader } from '@/lib/correlation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('listings')
    .select('*, properties(address, city, state, zip, bedrooms, bathrooms, sqft), leases(end_date, monthly_rent, landlord_tenants(name, email))')
    .eq('id', id)
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500;
    return setCorrelationIdHeader(
      NextResponse.json({ error: error.message }, { status }),
      correlationId,
    );
  }

  return setCorrelationIdHeader(NextResponse.json(data), correlationId);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);
  const { id } = await params;
  const supabase = await createClient();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return setCorrelationIdHeader(
      NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
      correlationId,
    );
  }

  const allowed = ['status', 'title', 'description', 'highlights', 'suggested_rent'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return setCorrelationIdHeader(
      NextResponse.json({ error: 'No valid fields to update' }, { status: 400 }),
      correlationId,
    );
  }

  const { data, error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return setCorrelationIdHeader(
      NextResponse.json({ error: error.message }, { status: 500 }),
      correlationId,
    );
  }

  return setCorrelationIdHeader(NextResponse.json(data), correlationId);
}

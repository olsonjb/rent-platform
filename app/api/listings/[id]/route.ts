import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiSuccess, apiError } from '@/lib/api-response';
import { getCorrelationId } from '@/lib/correlation';

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
    return apiError(error.message, status, correlationId, error.code);
  }

  return apiSuccess(data, correlationId);
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
    return apiError('Invalid JSON body', 400, correlationId, 'INVALID_JSON');
  }

  const allowed = ['status', 'title', 'description', 'highlights', 'suggested_rent'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return apiError('No valid fields to update', 400, correlationId, 'NO_FIELDS');
  }

  const { data, error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return apiError(error.message, 500, correlationId, 'DB_ERROR');
  }

  return apiSuccess(data, correlationId);
}

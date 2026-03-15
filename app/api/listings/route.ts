import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiSuccess, apiError } from '@/lib/api-response';
import { getCorrelationId } from '@/lib/correlation';

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('listings')
    .select('*, properties(address, city, state, zip), leases(end_date, monthly_rent, landlord_tenants(name, email))')
    .order('created_at', { ascending: false });

  if (error) {
    return apiError(error.message, 500, correlationId, "DB_ERROR");
  }

  return apiSuccess(data, correlationId);
}

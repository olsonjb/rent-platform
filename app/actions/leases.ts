'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { LeaseWithRelations } from '@/lib/types';

export async function getLeases(): Promise<LeaseWithRelations[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data, error } = await supabase
    .from('leases')
    .select('*, properties(address, city, state), landlord_tenants(name, email)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as LeaseWithRelations[];
}

const VALID_LEASE_STATUSES = ['active', 'pending', 'expired', 'terminated'] as const;

export async function createLease(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const status = formData.get('status') as string;
  if (!VALID_LEASE_STATUSES.includes(status as (typeof VALID_LEASE_STATUSES)[number])) {
    throw new Error(`Invalid lease status: ${status}`);
  }

  const startDate = formData.get('start_date') as string;
  const endDate = formData.get('end_date') as string;
  if (endDate <= startDate) {
    throw new Error('End date must be after start date');
  }

  const { error } = await supabase.from('leases').insert({
    landlord_id: user.id,
    property_id: formData.get('property_id') as string,
    tenant_id: formData.get('tenant_id') as string,
    start_date: startDate,
    end_date: endDate,
    monthly_rent: parseFloat(formData.get('monthly_rent') as string),
    status,
  });

  if (error) throw error;
  redirect('/protected/leases');
}

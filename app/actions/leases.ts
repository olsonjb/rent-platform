'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { validateCreateLease } from '@/lib/validation';
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

export async function createLease(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const validation = validateCreateLease(formData);
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0];
    throw new Error(firstError);
  }

  const { error } = await supabase.from('leases').insert({
    landlord_id: user.id,
    property_id: formData.get('property_id') as string,
    tenant_id: formData.get('tenant_id') as string,
    start_date: formData.get('start_date') as string,
    end_date: formData.get('end_date') as string,
    monthly_rent: parseFloat(formData.get('monthly_rent') as string),
    status: formData.get('status') as string,
  });

  if (error) throw error;
  redirect('/protected/leases');
}

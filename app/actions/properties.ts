'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Property } from '@/lib/types';

export async function getProperties(): Promise<Property[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('landlord_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createProperty(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { error } = await supabase.from('properties').insert({
    landlord_id: user.id,
    name: formData.get('name') as string,
    address: formData.get('address') as string,
    city: formData.get('city') as string,
    state: formData.get('state') as string,
    zip: formData.get('zip') as string,
    bedrooms: parseInt(formData.get('bedrooms') as string, 10),
    bathrooms: parseFloat(formData.get('bathrooms') as string),
    monthly_rent: parseFloat(formData.get('monthly_rent') as string),
    rent_due_day: parseInt(formData.get('rent_due_day') as string, 10) || 1,
  });

  if (error) throw error;
  redirect('/protected/properties');
}

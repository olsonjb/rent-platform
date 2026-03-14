'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Tenant } from '@/lib/types';

export async function getTenants(): Promise<Tenant[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createTenant(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { error } = await supabase.from('tenants').insert({
    landlord_id: user.id,
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    phone: (formData.get('phone') as string) || null,
  });

  if (error) throw error;
  redirect('/protected/tenants');
}

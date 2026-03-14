'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/service';
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

const isNonEmptyString = (value: FormDataEntryValue | null): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

const redirectToPropertiesWithStatus = (key: 'link_error' | 'link_success', message: string): never => {
  const params = new URLSearchParams({ [key]: message });
  redirect(`/protected/properties?${params.toString()}`);
};

export async function linkRenterToProperty(formData: FormData) {
  const propertyIdValue = formData.get('property_id');
  const renterIdValue = formData.get('renter_id');
  const unitValue = formData.get('unit');

  const propertyId = isNonEmptyString(propertyIdValue)
    ? propertyIdValue.trim()
    : redirectToPropertiesWithStatus('link_error', 'Property is required.');
  const renterId = isNonEmptyString(renterIdValue)
    ? renterIdValue.trim()
    : redirectToPropertiesWithStatus('link_error', 'Renter user ID is required.');
  const unit = isNonEmptyString(unitValue)
    ? unitValue.trim()
    : redirectToPropertiesWithStatus('link_error', 'Unit number is required.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('landlord_id', user.id)
    .maybeSingle();

  if (propertyError || !property) {
    redirectToPropertiesWithStatus('link_error', 'Property was not found for your account.');
  }

  const serviceClient = createServiceClient();

  const { data: tenant, error: tenantLookupError } = await serviceClient
    .from('tenants')
    .select('id, property_id')
    .eq('id', renterId)
    .maybeSingle();

  if (tenantLookupError) {
    redirectToPropertiesWithStatus('link_error', 'Unable to find renter profile right now.');
  }

  if (tenant?.property_id && tenant.property_id !== propertyId) {
    redirectToPropertiesWithStatus(
      'link_error',
      'This renter is already linked to another property.',
    );
  }

  if (tenant) {
    const { error: updateError } = await serviceClient
      .from('tenants')
      .update({ property_id: propertyId, unit })
      .eq('id', renterId);

    if (updateError) {
      redirectToPropertiesWithStatus('link_error', 'Unable to link renter right now.');
    }
  } else {
    const { error: insertError } = await serviceClient.from('tenants').insert({
      id: renterId,
      property_id: propertyId,
      unit,
      name: 'Resident',
    });

    if (insertError) {
      redirectToPropertiesWithStatus(
        'link_error',
        'Could not create renter profile. Confirm the renter user ID is valid.',
      );
    }
  }

  revalidatePath('/protected/properties');
  revalidatePath('/landlord/maintenance-requests');
  redirectToPropertiesWithStatus('link_success', 'Renter linked successfully.');
}

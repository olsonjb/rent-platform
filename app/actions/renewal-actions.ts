'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { generateRenewalOffer } from '@/lib/agent/renewal-content';
import type { RenewalOfferWithRelations } from '@/lib/types';

export async function getPendingRenewals(): Promise<RenewalOfferWithRelations[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data, error } = await supabase
    .from('renewal_offers')
    .select('*, leases(monthly_rent, start_date, end_date, property_id, properties(address, city, state)), landlord_tenants(name, email)')
    .eq('landlord_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as RenewalOfferWithRelations[];
}

export async function approveRenewal(offerId: string, modifiedRent?: number, modifiedEndDate?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Fetch the offer with relations
  const { data: offer, error: fetchError } = await supabase
    .from('renewal_offers')
    .select('*, leases(monthly_rent, start_date, end_date, property_id, properties(address, city, state)), landlord_tenants(name, email)')
    .eq('id', offerId)
    .eq('landlord_id', user.id)
    .single();

  if (fetchError || !offer) {
    throw new Error('Renewal offer not found');
  }

  const typedOffer = offer as unknown as RenewalOfferWithRelations;

  const finalRent = modifiedRent ?? typedOffer.new_monthly_rent;
  const finalEndDate = modifiedEndDate ?? typedOffer.new_end_date;

  // Generate offer letter
  const offerLetter = await generateRenewalOffer({
    evaluation: {
      recommendation: (typedOffer.ai_recommendation as 'renew-adjust' | 'renew-same' | 'do-not-renew') ?? 'renew-same',
      suggested_rent: finalRent,
      reasoning: typedOffer.ai_reasoning ?? '',
      tenant_score: 7,
      factors: {
        payment_history: 'Reviewed by landlord',
        maintenance_requests: 'Reviewed by landlord',
        tenure_length: 'Reviewed by landlord',
        communication: 'Reviewed by landlord',
      },
    },
    lease: {
      start_date: typedOffer.leases.start_date,
      end_date: typedOffer.leases.end_date,
      monthly_rent: typedOffer.leases.monthly_rent,
    },
    tenant: { name: typedOffer.landlord_tenants.name },
    property: {
      address: typedOffer.leases.properties.address,
      city: typedOffer.leases.properties.city,
      state: typedOffer.leases.properties.state,
    },
    newEndDate: finalEndDate,
    newRent: finalRent,
  });

  // Update offer with letter and mark as sent
  const { error: updateError } = await supabase
    .from('renewal_offers')
    .update({
      new_monthly_rent: finalRent,
      new_end_date: finalEndDate,
      offer_letter: offerLetter,
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', offerId);

  if (updateError) throw updateError;

  revalidatePath('/landlord/dashboard');
}

export async function declineRenewal(offerId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Fetch offer to get lease info
  const { data: offer, error: fetchError } = await supabase
    .from('renewal_offers')
    .select('lease_id')
    .eq('id', offerId)
    .eq('landlord_id', user.id)
    .single();

  if (fetchError || !offer) {
    throw new Error('Renewal offer not found');
  }

  // Mark offer as declined
  const { error: updateError } = await supabase
    .from('renewal_offers')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
    })
    .eq('id', offerId);

  if (updateError) throw updateError;

  // Mark the lease as renewal_offered = false so listing agent picks it up
  await supabase
    .from('leases')
    .update({ renewal_offered: false })
    .eq('id', offer.lease_id);

  revalidatePath('/landlord/dashboard');
}

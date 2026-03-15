'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function acceptRenewal(offerId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Fetch the offer — tenant access is enforced by RLS (auth_user_id match)
  const { data: offer, error: fetchError } = await supabase
    .from('renewal_offers')
    .select('id, lease_id, tenant_id, landlord_id, new_monthly_rent, new_end_date, status')
    .eq('id', offerId)
    .single();

  if (fetchError || !offer) {
    throw new Error('Renewal offer not found');
  }

  if (offer.status !== 'pending') {
    throw new Error('This offer is no longer available');
  }

  // Fetch the current lease to inherit property/tenant links
  const { data: currentLease, error: leaseError } = await supabase
    .from('leases')
    .select('id, landlord_id, property_id, tenant_id, end_date')
    .eq('id', offer.lease_id)
    .single();

  if (leaseError || !currentLease) {
    throw new Error('Associated lease not found');
  }

  // Mark offer as accepted
  const { error: updateOfferError } = await supabase
    .from('renewal_offers')
    .update({
      status: 'accepted',
      responded_at: new Date().toISOString(),
    })
    .eq('id', offerId);

  if (updateOfferError) throw updateOfferError;

  // Create new lease inheriting property/tenant links
  const { error: newLeaseError } = await supabase.from('leases').insert({
    landlord_id: currentLease.landlord_id,
    property_id: currentLease.property_id,
    tenant_id: currentLease.tenant_id,
    start_date: currentLease.end_date, // New lease starts when old ends
    end_date: offer.new_end_date,
    monthly_rent: offer.new_monthly_rent,
    status: 'active',
    renewal_offered: false,
  });

  if (newLeaseError) throw newLeaseError;

  // Update old lease to 'renewed'
  const { error: updateLeaseError } = await supabase
    .from('leases')
    .update({ status: 'renewed' })
    .eq('id', offer.lease_id);

  if (updateLeaseError) throw updateLeaseError;

  // Cancel any pending listings for this property
  const { data: pendingListings } = await supabase
    .from('listings')
    .select('id')
    .eq('lease_id', offer.lease_id)
    .in('status', ['pending', 'active']);

  if (pendingListings && pendingListings.length > 0) {
    for (const listing of pendingListings) {
      await supabase
        .from('listings')
        .update({ status: 'expired' })
        .eq('id', listing.id);
    }
  }

  revalidatePath('/protected/leases');
}

export async function declineRenewal(offerId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Fetch the offer
  const { data: offer, error: fetchError } = await supabase
    .from('renewal_offers')
    .select('id, lease_id, status')
    .eq('id', offerId)
    .single();

  if (fetchError || !offer) {
    throw new Error('Renewal offer not found');
  }

  if (offer.status !== 'pending') {
    throw new Error('This offer is no longer available');
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

  // Mark lease so listing agent can pick it up
  await supabase
    .from('leases')
    .update({ renewal_offered: false })
    .eq('id', offer.lease_id);

  revalidatePath('/protected/leases');
}

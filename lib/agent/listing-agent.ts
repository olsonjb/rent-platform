import { createServiceClient } from '@/lib/supabase/service';
import { makeListingDecision } from './decision';
import { generateListingContent } from './content';
import { submitToProviders } from './submit';
import type { Property, Lease } from '@/lib/types';

export async function runListingAgent(listingId: string): Promise<void> {
  const supabase = createServiceClient();

  // Fetch listing with relations
  const { data: listing, error: fetchError } = await supabase
    .from('listings')
    .select('*, properties(*), leases(*)')
    .eq('id', listingId)
    .single();

  if (fetchError || !listing) {
    console.error('[listing-agent] failed to fetch listing', listingId, fetchError);
    return;
  }

  const property = listing.properties as Property;
  const lease = listing.leases as Lease;

  const failListing = async (error: string) => {
    await supabase
      .from('listings')
      .update({ status: 'failed', updated_at: new Date().toISOString(), ai_decision: { error } })
      .eq('id', listingId);
  };

  // Step 1: AI decision
  let decision;
  try {
    decision = await makeListingDecision(property, lease);
  } catch (err) {
    console.error('[listing-agent] decision step failed', err);
    await failListing(`Decision step error: ${(err as Error).message}`);
    return;
  }

  // Store decision regardless
  await supabase
    .from('listings')
    .update({ ai_decision: decision, updated_at: new Date().toISOString() })
    .eq('id', listingId);

  if (!decision.should_list) {
    await supabase
      .from('listings')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', listingId);
    console.log(`[listing-agent] decided NOT to list ${listingId}: ${decision.reasoning}`);
    return;
  }

  // Step 2: Content generation
  let content;
  try {
    content = await generateListingContent(property, lease, decision);
  } catch (err) {
    console.error('[listing-agent] content step failed', err);
    await failListing(`Content step error: ${(err as Error).message}`);
    return;
  }

  await supabase
    .from('listings')
    .update({
      title: content.title,
      description: content.description,
      asking_price: content.asking_price,
      available_date: content.available_date,
      status: 'submitted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId);

  // Step 3: Submit to providers
  let providerResults;
  try {
    providerResults = await submitToProviders(property, content);
  } catch (err) {
    console.error('[listing-agent] submit step failed', err);
    await failListing(`Submit step error: ${(err as Error).message}`);
    return;
  }

  const anySuccess = Object.values(providerResults).some((r) => r.success);

  await supabase
    .from('listings')
    .update({
      status: anySuccess ? 'active' : 'failed',
      provider_results: providerResults,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId);

  console.log(`[listing-agent] done ${listingId} → ${anySuccess ? 'active' : 'failed'}`);
}

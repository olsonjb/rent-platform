import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { makeListingDecision, type AIDecision } from './decision';
import { generateListingContent, type AIContent } from './content';
import { submitToProviders } from './submit';
import type { PropertyListing } from '@/lib/providers';

const logger = createLogger('listing-agent');

interface ExpiringLease {
  id: string;
  end_date: string;
  monthly_rent: number;
  renewal_offered: boolean;
  property_id: string;
  properties: {
    id: string;
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sqft: number | null;
    monthly_rent: number | null;
  };
  landlord_tenants: {
    name: string;
    email: string;
  };
}

export interface ListingAgentResult {
  leaseId: string;
  propertyAddress: string;
  decision: AIDecision;
  content?: AIContent;
  listingId?: string;
  providerResults?: { provider: string; success: boolean; listingUrl?: string; error?: string }[];
}

export async function runListingAgent(): Promise<ListingAgentResult[]> {
  const supabase = createServiceClient();
  const results: ListingAgentResult[] = [];

  // Find active leases expiring within 30 days that don't already have a pending/active listing
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const { data: expiringLeases, error } = await supabase
    .from('leases')
    .select('id, end_date, monthly_rent, renewal_offered, property_id, properties(id, address, city, state, zip, bedrooms, bathrooms, sqft, monthly_rent), landlord_tenants(name, email)')
    .eq('status', 'active')
    .lte('end_date', thirtyDaysFromNow.toISOString().split('T')[0])
    .gte('end_date', new Date().toISOString().split('T')[0]);

  if (error || !expiringLeases || expiringLeases.length === 0) {
    return results;
  }

  for (const lease of expiringLeases as unknown as ExpiringLease[]) {
    try {
      // Check if listing already exists for this lease
      const { data: existingListing } = await supabase
        .from('listings')
        .select('id')
        .eq('lease_id', lease.id)
        .in('status', ['pending', 'active'])
        .limit(1);

      if (existingListing && existingListing.length > 0) {
        continue; // Skip — already has a listing
      }

      const prop = lease.properties;
      const tenant = lease.landlord_tenants;

      // Step 1: AI Decision
      const decision = await makeListingDecision({
        property: {
          address: prop.address,
          city: prop.city,
          state: prop.state,
          zip: prop.zip,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
          sqft: prop.sqft,
          monthly_rent: prop.monthly_rent,
        },
        lease: {
          end_date: lease.end_date,
          monthly_rent: lease.monthly_rent,
          tenant_name: tenant.name,
          renewal_offered: lease.renewal_offered,
        },
      });

      if (!decision.should_list) {
        results.push({ leaseId: lease.id, propertyAddress: prop.address, decision });
        continue;
      }

      // Step 2: Generate content
      const content = await generateListingContent({
        property: {
          address: prop.address,
          city: prop.city,
          state: prop.state,
          zip: prop.zip,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
          sqft: prop.sqft,
        },
        suggestedRent: decision.suggested_rent ?? lease.monthly_rent,
      });

      // Step 3: Submit to providers
      const providerListing: PropertyListing = {
        title: content.title,
        description: content.description,
        highlights: content.highlights,
        rent: decision.suggested_rent ?? lease.monthly_rent,
        bedrooms: prop.bedrooms ?? 0,
        bathrooms: prop.bathrooms ?? 1,
        sqft: prop.sqft,
        address: prop.address,
        city: prop.city ?? 'Unknown',
        state: prop.state ?? 'Unknown',
        zip: prop.zip ?? '00000',
      };

      const providerResults = await submitToProviders(providerListing);

      const anySuccess = providerResults.some((r) => r.success);

      // Step 4: Save to DB
      const { data: listing, error: insertError } = await supabase
        .from('listings')
        .insert({
          property_id: lease.property_id,
          lease_id: lease.id,
          status: anySuccess ? 'active' : 'error',
          ai_decision: decision,
          ai_content: content,
          suggested_rent: decision.suggested_rent,
          title: content.title,
          description: content.description,
          highlights: content.highlights,
          provider_results: providerResults,
        })
        .select('id')
        .single();

      if (insertError) {
        logger.error({ leaseId: lease.id, err: insertError }, 'DB insert failed for lease');
      }

      results.push({
        leaseId: lease.id,
        propertyAddress: prop.address,
        decision,
        content,
        listingId: listing?.id,
        providerResults,
      });
    } catch (err) {
      logger.error({ leaseId: lease.id, err }, 'Error processing lease');
      results.push({
        leaseId: lease.id,
        propertyAddress: lease.properties?.address ?? 'unknown',
        decision: { should_list: false, reasoning: `Agent error: ${err}`, suggested_rent: null, urgency: 'low' },
      });
    }
  }

  return results;
}

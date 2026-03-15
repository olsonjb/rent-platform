"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { makeListingDecision } from "@/lib/agent/decision";
import { generateListingContent } from "@/lib/agent/content";
import { submitToProviders } from "@/lib/agent/submit";
import type { PropertyListing } from "@/lib/providers";

interface ActionResult {
  success: boolean;
  message: string;
  listingId?: string;
}

export async function generateListingForProperty(
  propertyId: string
): Promise<ActionResult> {
  // 1. Authenticate user
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, message: "Not authenticated" };
  }

  // 2. Verify property belongs to this landlord
  const { data: property, error: propError } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .eq("landlord_id", user.id)
    .single();

  if (propError || !property) {
    return { success: false, message: "Property not found or access denied" };
  }

  // 3. Find any active lease for this property (with tenant name for AI context)
  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select("*, landlord_tenants(name)")
    .eq("property_id", propertyId)
    .eq("status", "active")
    .order("end_date", { ascending: true })
    .limit(1)
    .single();

  if (leaseError || !lease) {
    return {
      success: false,
      message: "No active lease found for this property. Create a lease first.",
    };
  }

  // 4. Check if there's already a pending or active listing for this lease
  const serviceClient = createServiceClient();
  const { data: existingListing } = await serviceClient
    .from("listings")
    .select("id, status")
    .eq("lease_id", lease.id)
    .in("status", ["pending", "active"])
    .limit(1)
    .maybeSingle();

  if (existingListing) {
    return {
      success: false,
      message: `A ${existingListing.status} listing already exists for this lease`,
      listingId: existingListing.id,
    };
  }

  // 5. AI pipeline: decision
  const decision = await makeListingDecision({
    property: {
      address: property.address,
      city: property.city,
      state: property.state,
      zip: property.zip,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      sqft: property.sqft,
      monthly_rent: property.monthly_rent,
    },
    lease: {
      end_date: lease.end_date,
      monthly_rent: lease.monthly_rent,
      tenant_name: (lease.landlord_tenants as { name: string } | null)?.name ?? "Unknown",
      renewal_offered: lease.renewal_offered ?? false,
    },
  });

  if (!decision.should_list) {
    return {
      success: false,
      message: `AI decided not to list: ${decision.reasoning}`,
    };
  }

  // 6. AI pipeline: content generation
  const suggestedRent = decision.suggested_rent ?? lease.monthly_rent;
  const content = await generateListingContent({
    property: {
      address: property.address,
      city: property.city,
      state: property.state,
      zip: property.zip,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      sqft: property.sqft,
    },
    suggestedRent,
  });

  // 7. AI pipeline: submit to providers
  const providerListing: PropertyListing = {
    title: content.title,
    description: content.description,
    highlights: content.highlights,
    rent: suggestedRent,
    bedrooms: property.bedrooms ?? 0,
    bathrooms: Number(property.bathrooms ?? 0),
    sqft: property.sqft ?? null,
    address: property.address,
    city: property.city ?? "",
    state: property.state ?? "",
    zip: property.zip ?? "",
  };

  const submitResults = await submitToProviders(providerListing);

  // 8. Save listing to DB
  const anySuccess = submitResults.some((r) => r.success);
  const { data: newListing, error: insertError } = await serviceClient
    .from("listings")
    .insert({
      property_id: propertyId,
      lease_id: lease.id,
      status: anySuccess ? "active" : "error",
      title: content.title,
      description: content.description,
      highlights: content.highlights,
      suggested_rent: suggestedRent,
      ai_decision: decision,
      ai_content: content,
      provider_results: submitResults,
    })
    .select("id")
    .single();

  if (insertError || !newListing) {
    return {
      success: false,
      message: `Failed to save listing: ${insertError?.message ?? "Unknown error"}`,
    };
  }

  return {
    success: true,
    message: `Listing created and submitted to ${submitResults.filter((r) => r.success).length}/${submitResults.length} providers`,
    listingId: newListing.id,
  };
}

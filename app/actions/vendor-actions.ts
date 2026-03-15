"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendSms } from "@/lib/twilio/sms";
import { dispatchVendors } from "@/lib/agent/vendor-dispatch";
import type { VendorContact } from "@/lib/agent/vendor-dispatch";

async function requireLandlord() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login");

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) redirect("/auth/login");

  const roles = getUserRolesFromClaims(claimsData.claims);
  if (!roles.includes("landlord")) redirect("/auth/login");

  return { supabase, user };
}

/**
 * Approve a vendor quote. Updates maintenance request status and notifies vendor.
 */
export async function approveQuote(outreachId: string) {
  const { supabase } = await requireLandlord();

  // Load the outreach record (RLS ensures landlord ownership)
  const { data: outreach, error: loadError } = await supabase
    .from("vendor_outreach")
    .select("id, maintenance_request_id, vendor_name, vendor_phone, status, quote_amount_cents")
    .eq("id", outreachId)
    .single();

  if (loadError || !outreach) {
    return { error: "Quote not found or access denied." };
  }

  if (outreach.status !== "responded") {
    return { error: "Can only approve quotes that have a response." };
  }

  // Update outreach — mark all other outreach for this request as declined
  const serviceClient = createServiceClient();

  const { error: declineError } = await serviceClient
    .from("vendor_outreach")
    .update({ status: "declined" })
    .eq("maintenance_request_id", outreach.maintenance_request_id)
    .neq("id", outreachId)
    .eq("status", "sent");

  if (declineError) {
    return { error: "Failed to update other vendor statuses." };
  }

  // Update maintenance request status to in_progress
  const { error: mrError } = await serviceClient
    .from("maintenance_requests")
    .update({ status: "in_progress" })
    .eq("id", outreach.maintenance_request_id);

  if (mrError) {
    return { error: "Failed to update maintenance request status." };
  }

  // Notify vendor via SMS
  if (outreach.vendor_phone) {
    const amountText = outreach.quote_amount_cents
      ? `$${(outreach.quote_amount_cents / 100).toFixed(2)}`
      : "your quote";
    const msg = `Your quote of ${amountText} has been approved! Please contact us to schedule the work. Thank you, ${outreach.vendor_name}.`;
    await sendSms(outreach.vendor_phone, msg).catch(() => {
      // Non-critical: notification failure shouldn't block approval
    });
  }

  revalidatePath(`/landlord/maintenance/${outreach.maintenance_request_id}`);
  revalidatePath("/landlord/maintenance-requests");

  return { success: true };
}

/**
 * Request more quotes by contacting additional vendors for a maintenance request.
 */
export async function requestMoreQuotes(maintenanceRequestId: string) {
  const { supabase } = await requireLandlord();

  // Load the maintenance request review to get vendor list
  const { data: review, error: reviewError } = await supabase
    .from("maintenance_request_reviews")
    .select("trade, estimated_cost_min, estimated_cost_max, vendors")
    .eq("maintenance_request_id", maintenanceRequestId)
    .single();

  if (reviewError || !review) {
    return { error: "No review found for this maintenance request." };
  }

  // Load maintenance request details
  const serviceClient = createServiceClient();
  const { data: mr, error: mrError } = await serviceClient
    .from("maintenance_requests")
    .select("id, issue, unit, tenants(name, phone, properties(name, address))")
    .eq("id", maintenanceRequestId)
    .single();

  if (mrError || !mr) {
    return { error: "Maintenance request not found." };
  }

  const tenantRelation = mr.tenants;
  const tenant = Array.isArray(tenantRelation) ? tenantRelation[0] : tenantRelation;
  const propertyRelation = tenant?.properties;
  const property = Array.isArray(propertyRelation) ? propertyRelation[0] : propertyRelation;

  if (!property) {
    return { error: "Property information not available." };
  }

  // Find vendors not yet contacted
  const { data: existingOutreach } = await serviceClient
    .from("vendor_outreach")
    .select("vendor_name")
    .eq("maintenance_request_id", maintenanceRequestId);

  const contactedNames = new Set((existingOutreach ?? []).map((o: { vendor_name: string }) => o.vendor_name));
  const allVendors = (Array.isArray(review.vendors) ? review.vendors : []) as VendorContact[];
  const newVendors = allVendors.filter((v) => !contactedNames.has(v.name));

  if (newVendors.length === 0) {
    return { error: "No additional vendors available to contact." };
  }

  const contacted = await dispatchVendors({
    maintenanceRequestId,
    issue: mr.issue,
    propertyAddress: property.address,
    propertyName: property.name,
    unit: mr.unit,
    trade: review.trade,
    estimatedCostMin: review.estimated_cost_min,
    estimatedCostMax: review.estimated_cost_max,
    vendors: newVendors,
  });

  revalidatePath(`/landlord/maintenance/${maintenanceRequestId}`);
  revalidatePath("/landlord/maintenance-requests");

  return { success: true, contacted };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";
import { createClient } from "@/lib/supabase/server";
import { mapFlagsToReasons, generateAdverseActionNotice } from "@/lib/screening/adverse-action";
import { logScreeningEvent } from "@/lib/screening/audit-log";

export async function getPropertyApplications(propertyId?: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login");

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) redirect("/auth/login");

  const roles = getUserRolesFromClaims(claimsData.claims);
  if (!roles.includes("landlord")) redirect("/auth/login");

  let query = supabase
    .from("rental_applications")
    .select("*, properties(address, name, monthly_rent)")
    .order("created_at", { ascending: false });

  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data, error } = await query;

  if (error) throw new Error("Unable to load applications.");

  return data ?? [];
}

export async function getApplicationDetail(applicationId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login");

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) redirect("/auth/login");

  const roles = getUserRolesFromClaims(claimsData.claims);
  if (!roles.includes("landlord")) redirect("/auth/login");

  const { data, error } = await supabase
    .from("rental_applications")
    .select("*, properties(address, name, monthly_rent)")
    .eq("id", applicationId)
    .single();

  if (error || !data) throw new Error("Application not found.");

  return data;
}

export async function overrideApplicationDecision(
  applicationId: string,
  status: "landlord_approved" | "landlord_denied",
  notes?: string,
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login");

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) redirect("/auth/login");

  const roles = getUserRolesFromClaims(claimsData.claims);
  if (!roles.includes("landlord")) redirect("/auth/login");

  const updatePayload: Record<string, unknown> = {
    status,
    landlord_notes: notes ?? null,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  };

  // On denial, generate adverse action notice
  if (status === "landlord_denied") {
    const { data: app } = await supabase
      .from("rental_applications")
      .select("full_name, ai_decision, properties(address)")
      .eq("id", applicationId)
      .single();

    if (app) {
      const aiDecision = (app.ai_decision ?? {}) as Record<string, unknown>;
      const flags = Array.isArray(aiDecision.flags) ? (aiDecision.flags as string[]) : [];
      const reasons = mapFlagsToReasons(flags);
      const property = Array.isArray(app.properties) ? app.properties[0] : app.properties;
      const address = (property as { address?: string })?.address ?? "the property";
      const notice = generateAdverseActionNotice(app.full_name as string, reasons, address);
      updatePayload.adverse_action_notice = notice;
    }
  }

  const { error } = await supabase
    .from("rental_applications")
    .update(updatePayload)
    .eq("id", applicationId);

  if (error) throw new Error("Unable to update application decision.");

  // Log audit events
  await logScreeningEvent(applicationId, "landlord_override", {
    decision: status,
    notes: notes ?? null,
  }, user.id);

  await logScreeningEvent(applicationId, "final_decision", {
    status,
  }, user.id);

  revalidatePath("/landlord/applications");
  revalidatePath(`/landlord/applications/${applicationId}`);
}

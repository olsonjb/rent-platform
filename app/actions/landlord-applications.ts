"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase
    .from("rental_applications")
    .update({
      status,
      landlord_notes: notes ?? null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (error) throw new Error("Unable to update application decision.");

  revalidatePath("/landlord/applications");
  revalidatePath(`/landlord/applications/${applicationId}`);
}

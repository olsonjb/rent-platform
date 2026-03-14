"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";
import { triggerApplicationScreeningProcessingInBackground } from "@/lib/application-screening-worker";
import { createClient } from "@/lib/supabase/server";

const isNonEmptyString = (value: FormDataEntryValue | null): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const VALID_CREDIT_RANGES = ['below_580', '580_619', '620_659', '660_699', '700_749', '750_plus'];
const VALID_EMPLOYMENT_TYPES = ['full_time', 'part_time', 'self_employed', 'retired', 'other'];

export async function submitApplication(formData: FormData) {
  const propertyId = formData.get("propertyId");
  const listingId = formData.get("listingId");
  const fullName = formData.get("fullName");
  const email = formData.get("email");
  const phone = formData.get("phone");
  const creditScoreRange = formData.get("creditScoreRange");
  const monthlyIncome = formData.get("monthlyIncome");
  const employerName = formData.get("employerName");
  const employmentDuration = formData.get("employmentDuration");
  const employmentType = formData.get("employmentType");
  const yearsRenting = formData.get("yearsRenting");
  const previousEvictions = formData.get("previousEvictions");

  // Parse references
  const references: { name: string; phone: string; relationship: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const refName = formData.get(`refName${i}`);
    const refPhone = formData.get(`refPhone${i}`);
    const refRelationship = formData.get(`refRelationship${i}`);
    if (isNonEmptyString(refName) && isNonEmptyString(refPhone) && isNonEmptyString(refRelationship)) {
      references.push({ name: refName.trim(), phone: refPhone.trim(), relationship: refRelationship.trim() });
    }
  }

  // Parse social media links
  const socialMediaLinks: string[] = [];
  for (let i = 0; i < 5; i++) {
    const link = formData.get(`socialMedia${i}`);
    if (isNonEmptyString(link)) {
      socialMediaLinks.push(link.trim());
    }
  }

  const redirectListingId = typeof listingId === "string" ? listingId : "";

  const redirectWithError = (message: string): never => {
    const params = new URLSearchParams({ error: message });
    redirect(`/renter/applications/${redirectListingId}/apply?${params.toString()}`);
  };

  if (!isNonEmptyString(propertyId)) redirectWithError("Missing property.");
  if (!isNonEmptyString(fullName)) redirectWithError("Please enter your full name.");
  if (!isNonEmptyString(email)) redirectWithError("Please enter your email.");

  const creditRange = typeof creditScoreRange === "string" ? creditScoreRange : "";
  if (!VALID_CREDIT_RANGES.includes(creditRange)) redirectWithError("Please select a valid credit score range.");

  const income = Number(monthlyIncome);
  if (!Number.isFinite(income) || income <= 0) redirectWithError("Please enter a valid monthly income.");

  const empType = typeof employmentType === "string" ? employmentType : "";
  if (empType && !VALID_EMPLOYMENT_TYPES.includes(empType)) redirectWithError("Please select a valid employment type.");

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login");

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) redirect("/auth/login");

  const roles = getUserRolesFromClaims(claimsData.claims);
  if (!roles.includes("renter")) redirect("/auth/login");

  const { error } = await supabase.from("rental_applications").insert({
    property_id: (propertyId as string).trim(),
    listing_id: isNonEmptyString(listingId) ? listingId.trim() : null,
    applicant_id: user.id,
    full_name: (fullName as string).trim(),
    email: (email as string).trim(),
    phone: isNonEmptyString(phone) ? (phone as string).trim() : null,
    credit_score_range: creditRange,
    monthly_income: income,
    employer_name: isNonEmptyString(employerName) ? (employerName as string).trim() : null,
    employment_duration_months: employmentDuration ? Number(employmentDuration) || null : null,
    employment_type: empType || null,
    years_renting: Number(yearsRenting) || 0,
    previous_evictions: previousEvictions === "yes",
    references,
    social_media_links: socialMediaLinks,
  });

  if (error) {
    if (error.code === "23505") {
      redirectWithError("You already have an active application for this property.");
    }
    redirectWithError("Unable to submit application. Please try again.");
  }

  triggerApplicationScreeningProcessingInBackground();

  revalidatePath("/renter/applications");
  redirect("/renter/applications?success=1");
}

export async function withdrawApplication(applicationId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login");

  const { error } = await supabase
    .from("rental_applications")
    .update({ status: "withdrawn" })
    .eq("id", applicationId)
    .eq("applicant_id", user.id);

  if (error) {
    throw new Error("Unable to withdraw application.");
  }

  revalidatePath("/renter/applications");
}

export async function getMyApplications() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/login");

  const { data, error } = await supabase
    .from("rental_applications")
    .select("*, properties(address, name, monthly_rent)")
    .eq("applicant_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Unable to load applications.");

  return data ?? [];
}

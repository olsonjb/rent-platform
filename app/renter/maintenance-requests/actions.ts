"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isMaintenanceRequestEntryPermission,
  isMaintenanceRequestLocation,
  isMaintenanceRequestUrgency,
} from "@/lib/maintenance-requests";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";
import { createClient } from "@/lib/supabase/server";

const isNonEmptyString = (value: FormDataEntryValue | null): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const redirectWithError = (message: string): never => {
  const params = new URLSearchParams({ error: message });
  redirect(`/renter/maintenance-requests/new?${params.toString()}`);
};

const getTenantDisplayName = (user: {
  email?: string | null;
  user_metadata?: unknown;
}): string => {
  if (typeof user.user_metadata === "object" && user.user_metadata !== null) {
    const metadata = user.user_metadata as Record<string, unknown>;
    const fullName = metadata.full_name;
    if (typeof fullName === "string" && fullName.trim().length > 0) {
      return fullName.trim();
    }

    const name = metadata.name;
    if (typeof name === "string" && name.trim().length > 0) {
      return name.trim();
    }
  }

  if (typeof user.email === "string" && user.email.length > 0) {
    const emailName = user.email.split("@")[0];
    if (emailName && emailName.trim().length > 0) {
      return emailName.trim();
    }
  }

  return "Resident";
};

export async function createMaintenanceRequest(formData: FormData) {
  const issueTitleValue = formData.get("issueTitle");
  const unitValue = formData.get("unit");
  const locationValue = formData.get("location");
  const urgencyValue = formData.get("urgency");
  const detailsValue = formData.get("details");
  const entryPermissionValue = formData.get("entryPermission");
  const phoneValue = formData.get("phone");

  const issueTitle = isNonEmptyString(issueTitleValue)
    ? issueTitleValue.trim()
    : redirectWithError("Please add an issue title.");

  const unit = isNonEmptyString(unitValue)
    ? unitValue.trim()
    : redirectWithError("Please add your unit number.");

  if (!isMaintenanceRequestLocation(locationValue)) {
    redirectWithError("Please choose a valid location.");
  }

  if (!isMaintenanceRequestUrgency(urgencyValue)) {
    redirectWithError("Please choose a valid urgency.");
  }

  const details = isNonEmptyString(detailsValue)
    ? detailsValue.trim()
    : redirectWithError("Please describe the issue.");

  if (!isMaintenanceRequestEntryPermission(entryPermissionValue)) {
    redirectWithError("Please choose a valid entry permission.");
  }

  const contactPhone = isNonEmptyString(phoneValue)
    ? phoneValue.trim()
    : redirectWithError("Please provide a contact number.");

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/login");
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/auth/login");
  }

  const roles = getUserRolesFromClaims(claimsData.claims);

  if (!roles.includes("renter")) {
    redirect("/auth/login");
  }

  const { data: tenantProfile, error: tenantProfileError } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (tenantProfileError) {
    redirectWithError("Unable to validate your renter profile. Please try again.");
  }

  if (!tenantProfile) {
    const { error: tenantInsertError } = await supabase.from("tenants").insert({
      id: user.id,
      unit,
      name: getTenantDisplayName(user),
    });

    if (tenantInsertError) {
      redirectWithError(
        "Unable to set up your renter profile. Please contact your property manager.",
      );
    }
  }

  const { error } = await supabase.from("maintenance_requests").insert({
    tenant_id: user.id,
    issue: issueTitle,
    unit,
    location: locationValue,
    urgency: urgencyValue,
    details,
    entry_permission: entryPermissionValue,
    contact_phone: contactPhone,
  });

  if (error) {
    redirectWithError("Unable to submit request. Please try again.");
  }

  revalidatePath("/renter/maintenance-requests");
  redirect("/renter/maintenance-requests?success=1");
}

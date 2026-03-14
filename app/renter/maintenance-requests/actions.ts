"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isMaintenanceRequestEntryPermission,
  isMaintenanceRequestLocation,
  isMaintenanceRequestUrgency,
} from "@/lib/maintenance-requests";
import { createClient } from "@/lib/supabase/server";

const isNonEmptyString = (value: FormDataEntryValue | null): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const redirectWithError = (message: string): never => {
  const params = new URLSearchParams({ error: message });
  redirect(`/renter/maintenance-requests/new?${params.toString()}`);
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
  redirect("/renter/maintenance-requests/new?success=1");
}

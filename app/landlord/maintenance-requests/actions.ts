"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isMaintenanceRequestStatus } from "@/lib/maintenance-requests";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";
import { createClient } from "@/lib/supabase/server";

const isNonEmptyString = (value: FormDataEntryValue | null): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

export async function updateMaintenanceRequestStatus(formData: FormData) {
  const requestIdValue = formData.get("requestId");
  const statusValue = formData.get("status");

  const requestId = isNonEmptyString(requestIdValue) ? requestIdValue.trim() : null;

  if (!requestId || !isMaintenanceRequestStatus(statusValue)) {
    return;
  }

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
  if (!roles.includes("landlord")) {
    redirect("/auth/login");
  }

  const { error } = await supabase
    .from("maintenance_requests")
    .update({ status: statusValue })
    .eq("id", requestId);

  if (error) {
    console.error("Unable to update maintenance request status", {
      requestId,
      status: statusValue,
      error: error.message,
    });
    return;
  }

  revalidatePath("/landlord/maintenance-requests");
}

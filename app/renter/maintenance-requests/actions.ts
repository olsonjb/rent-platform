"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isMaintenanceRequestEntryPermission,
  isMaintenanceRequestLocation,
  isMaintenanceRequestUrgency,
} from "@/lib/maintenance-requests";
import { getUserRolesFromClaims } from "@/lib/auth/user-types";
import { triggerMaintenanceReviewProcessingInBackground } from "@/lib/maintenance-review-worker";
import { createClient } from "@/lib/supabase/server";
import { validatePhotoFile, uploadMaintenancePhoto } from "@/lib/storage/photos";

const MAX_PHOTOS = 5;

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

  // Validate photos server-side
  const photoFiles = formData.getAll("photos").filter(
    (entry): entry is File => entry instanceof File && entry.size > 0,
  );

  if (photoFiles.length > MAX_PHOTOS) {
    redirectWithError(`Maximum ${MAX_PHOTOS} photos allowed.`);
  }

  for (const file of photoFiles) {
    const validation = validatePhotoFile(file);
    if (!validation.valid) {
      const msg =
        validation.error.type === "too_large"
          ? "Photo exceeds 10MB limit."
          : validation.error.type === "invalid_type"
            ? "Only JPEG, PNG, WebP, and GIF images are allowed."
            : "Invalid photo file.";
      redirectWithError(msg);
    }
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

  // Insert the maintenance request first to get the ID
  const { data: insertedRequest, error } = await supabase
    .from("maintenance_requests")
    .insert({
      tenant_id: user.id,
      issue: issueTitle,
      unit,
      location: locationValue,
      urgency: urgencyValue,
      details,
      entry_permission: entryPermissionValue,
      contact_phone: contactPhone,
    })
    .select("id")
    .single();

  if (error || !insertedRequest) {
    return redirectWithError("Unable to submit request. Please try again.");
  }

  const requestId: string = insertedRequest.id;

  // Upload photos and store URLs
  if (photoFiles.length > 0) {
    const photoUrls: string[] = [];

    for (let i = 0; i < photoFiles.length; i++) {
      const url = await uploadMaintenancePhoto(photoFiles[i], requestId, i);
      if (url) {
        photoUrls.push(url);
      }
    }

    if (photoUrls.length > 0) {
      await supabase
        .from("maintenance_requests")
        .update({ photos: photoUrls })
        .eq("id", requestId);
    }
  }

  triggerMaintenanceReviewProcessingInBackground();

  revalidatePath("/renter/maintenance-requests");
  const params = new URLSearchParams({
    success: "1",
    requestId,
  });
  redirect(`/renter/maintenance-requests/new?${params.toString()}`);
}

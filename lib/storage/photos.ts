import { createClient } from "@/lib/supabase/server";

const BUCKET_NAME = "maintenance-photos";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type PhotoValidationError =
  | { type: "invalid_type"; mime: string }
  | { type: "too_large"; size: number; max: number }
  | { type: "empty" };

export type PhotoValidationResult =
  | { valid: true }
  | { valid: false; error: PhotoValidationError };

/** Validate that a file is an acceptable photo upload. */
export function validatePhotoFile(file: File): PhotoValidationResult {
  if (file.size === 0) {
    return { valid: false, error: { type: "empty" } };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: { type: "too_large", size: file.size, max: MAX_FILE_SIZE },
    };
  }

  if (
    !ALLOWED_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return { valid: false, error: { type: "invalid_type", mime: file.type } };
  }

  return { valid: true };
}

/**
 * Upload a maintenance request photo to Supabase Storage.
 * Returns the public URL on success, or null on failure.
 */
export async function uploadMaintenancePhoto(
  file: File,
  requestId: string,
  index: number,
): Promise<string | null> {
  const supabase = await createClient();

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${requestId}/${index}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);

  return publicUrl;
}

/** Get the public URL for a maintenance photo path. */
export async function getMaintenancePhotoUrl(
  path: string,
): Promise<string> {
  const supabase = await createClient();

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);

  return publicUrl;
}

export { BUCKET_NAME, MAX_FILE_SIZE, ALLOWED_MIME_TYPES };

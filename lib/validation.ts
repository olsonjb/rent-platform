/**
 * Lightweight input validation helpers for server actions.
 *
 * Returns user-friendly error messages; does NOT throw.
 * Each validator returns null on success or an error string on failure.
 */

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

function fail(field: string, message: string): Record<string, string> {
  return { [field]: message };
}

/** Require a non-empty trimmed string. */
function requireString(
  formData: FormData,
  field: string,
  label: string
): string | null {
  const value = formData.get(field);
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

/** Require a valid positive number. */
function requirePositiveNumber(
  formData: FormData,
  field: string,
  _label: string
): number | null {
  const raw = formData.get(field);
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const num = Number(raw);
  if (isNaN(num) || num <= 0) return null;
  return num;
}

// ─── Property Validation ────────────────────────────────────────────

export function validateCreateProperty(formData: FormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!requireString(formData, "name", "Property name")) {
    Object.assign(errors, fail("name", "Property name is required."));
  }
  if (!requireString(formData, "address", "Address")) {
    Object.assign(errors, fail("address", "Address is required."));
  }
  if (!requireString(formData, "city", "City")) {
    Object.assign(errors, fail("city", "City is required."));
  }
  if (!requireString(formData, "state", "State")) {
    Object.assign(errors, fail("state", "State is required."));
  }
  if (!requireString(formData, "zip", "ZIP code")) {
    Object.assign(errors, fail("zip", "ZIP code is required."));
  }

  const bedrooms = formData.get("bedrooms");
  if (typeof bedrooms === "string" && bedrooms.trim().length > 0) {
    const n = parseInt(bedrooms, 10);
    if (isNaN(n) || n < 0) {
      Object.assign(errors, fail("bedrooms", "Bedrooms must be a non-negative number."));
    }
  }

  const bathrooms = formData.get("bathrooms");
  if (typeof bathrooms === "string" && bathrooms.trim().length > 0) {
    const n = parseFloat(bathrooms);
    if (isNaN(n) || n < 0) {
      Object.assign(errors, fail("bathrooms", "Bathrooms must be a non-negative number."));
    }
  }

  const monthlyRent = formData.get("monthly_rent");
  if (typeof monthlyRent === "string" && monthlyRent.trim().length > 0) {
    const n = parseFloat(monthlyRent);
    if (isNaN(n) || n < 0) {
      Object.assign(errors, fail("monthly_rent", "Monthly rent must be a non-negative number."));
    }
  }

  const rentDueDay = formData.get("rent_due_day");
  if (typeof rentDueDay === "string" && rentDueDay.trim().length > 0) {
    const n = parseInt(rentDueDay, 10);
    if (isNaN(n) || n < 1 || n > 31) {
      Object.assign(errors, fail("rent_due_day", "Rent due day must be between 1 and 31."));
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ─── Lease Validation ───────────────────────────────────────────────

const VALID_LEASE_STATUSES = ["active", "pending", "expired", "terminated"] as const;

export function validateCreateLease(formData: FormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!requireString(formData, "property_id", "Property")) {
    Object.assign(errors, fail("property_id", "Property is required."));
  }
  if (!requireString(formData, "tenant_id", "Tenant")) {
    Object.assign(errors, fail("tenant_id", "Tenant is required."));
  }

  const startDate = requireString(formData, "start_date", "Start date");
  if (!startDate) {
    Object.assign(errors, fail("start_date", "Start date is required."));
  }

  const endDate = requireString(formData, "end_date", "End date");
  if (!endDate) {
    Object.assign(errors, fail("end_date", "End date is required."));
  }

  if (startDate && endDate && endDate <= startDate) {
    Object.assign(errors, fail("end_date", "End date must be after start date."));
  }

  if (!requirePositiveNumber(formData, "monthly_rent", "Monthly rent")) {
    Object.assign(errors, fail("monthly_rent", "Monthly rent must be a positive number."));
  }

  const status = formData.get("status") as string;
  if (
    !status ||
    !VALID_LEASE_STATUSES.includes(status as (typeof VALID_LEASE_STATUSES)[number])
  ) {
    Object.assign(
      errors,
      fail("status", `Status must be one of: ${VALID_LEASE_STATUSES.join(", ")}.`)
    );
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ─── Tenant Validation ──────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCreateTenant(formData: FormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!requireString(formData, "name", "Name")) {
    Object.assign(errors, fail("name", "Tenant name is required."));
  }

  const email = requireString(formData, "email", "Email");
  if (!email) {
    Object.assign(errors, fail("email", "Email is required."));
  } else if (!EMAIL_REGEX.test(email)) {
    Object.assign(errors, fail("email", "Please enter a valid email address."));
  }

  // Phone is optional but if provided, must have at least 7 digits
  const phone = formData.get("phone");
  if (typeof phone === "string" && phone.trim().length > 0) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) {
      Object.assign(errors, fail("phone", "Please enter a valid phone number."));
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

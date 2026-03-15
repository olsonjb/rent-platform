import { describe, it, expect } from "vitest";
import {
  validateCreateProperty,
  validateCreateLease,
  validateCreateTenant,
} from "@/lib/validation";

function makeFormData(obj: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(obj)) {
    fd.set(key, value);
  }
  return fd;
}

// ─── Property Validation ────────────────────────────────────────────

describe("validateCreateProperty", () => {
  const validProperty = {
    name: "Maple Apartments",
    address: "123 Main St",
    city: "Salt Lake City",
    state: "UT",
    zip: "84101",
    bedrooms: "3",
    bathrooms: "2",
    monthly_rent: "1500",
    rent_due_day: "1",
  };

  it("passes with valid input", () => {
    const result = validateCreateProperty(makeFormData(validProperty));
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it("fails when name is missing", () => {
    const data = { ...validProperty };
    delete (data as Record<string, string | undefined>).name;
    const result = validateCreateProperty(makeFormData(data));
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it("fails when address is empty", () => {
    const result = validateCreateProperty(
      makeFormData({ ...validProperty, address: "  " })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.address).toContain("required");
  });

  it("fails when city is missing", () => {
    const data = { ...validProperty };
    delete (data as Record<string, string | undefined>).city;
    const result = validateCreateProperty(makeFormData(data));
    expect(result.valid).toBe(false);
    expect(result.errors.city).toBeDefined();
  });

  it("fails when bedrooms is negative", () => {
    const result = validateCreateProperty(
      makeFormData({ ...validProperty, bedrooms: "-1" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.bedrooms).toBeDefined();
  });

  it("fails when rent_due_day is out of range", () => {
    const result = validateCreateProperty(
      makeFormData({ ...validProperty, rent_due_day: "32" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.rent_due_day).toContain("between 1 and 31");
  });

  it("passes when optional fields are omitted", () => {
    const minimal = {
      name: "Test",
      address: "123 St",
      city: "City",
      state: "UT",
      zip: "12345",
    };
    const result = validateCreateProperty(makeFormData(minimal));
    expect(result.valid).toBe(true);
  });

  it("collects multiple errors at once", () => {
    const result = validateCreateProperty(makeFormData({}));
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(5);
  });
});

// ─── Lease Validation ───────────────────────────────────────────────

describe("validateCreateLease", () => {
  const validLease = {
    property_id: "prop-123",
    tenant_id: "tenant-456",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    monthly_rent: "1500",
    status: "active",
  };

  it("passes with valid input", () => {
    const result = validateCreateLease(makeFormData(validLease));
    expect(result.valid).toBe(true);
  });

  it("fails when property_id is missing", () => {
    const data = { ...validLease };
    delete (data as Record<string, string | undefined>).property_id;
    const result = validateCreateLease(makeFormData(data));
    expect(result.valid).toBe(false);
    expect(result.errors.property_id).toBeDefined();
  });

  it("fails when end_date is before start_date", () => {
    const result = validateCreateLease(
      makeFormData({ ...validLease, end_date: "2025-12-31" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.end_date).toContain("after start date");
  });

  it("fails when end_date equals start_date", () => {
    const result = validateCreateLease(
      makeFormData({ ...validLease, start_date: "2026-06-01", end_date: "2026-06-01" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.end_date).toBeDefined();
  });

  it("fails when monthly_rent is zero", () => {
    const result = validateCreateLease(
      makeFormData({ ...validLease, monthly_rent: "0" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.monthly_rent).toBeDefined();
  });

  it("fails when status is invalid", () => {
    const result = validateCreateLease(
      makeFormData({ ...validLease, status: "cancelled" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.status).toContain("must be one of");
  });

  it("accepts all valid statuses", () => {
    for (const status of ["active", "pending", "expired", "terminated"]) {
      const result = validateCreateLease(
        makeFormData({ ...validLease, status })
      );
      expect(result.valid).toBe(true);
    }
  });
});

// ─── Tenant Validation ──────────────────────────────────────────────

describe("validateCreateTenant", () => {
  const validTenant = {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+15551234567",
  };

  it("passes with valid input", () => {
    const result = validateCreateTenant(makeFormData(validTenant));
    expect(result.valid).toBe(true);
  });

  it("fails when name is missing", () => {
    const data = { ...validTenant };
    delete (data as Record<string, string | undefined>).name;
    const result = validateCreateTenant(makeFormData(data));
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it("fails when email is missing", () => {
    const data = { ...validTenant };
    delete (data as Record<string, string | undefined>).email;
    const result = validateCreateTenant(makeFormData(data));
    expect(result.valid).toBe(false);
    expect(result.errors.email).toBeDefined();
  });

  it("fails when email is invalid", () => {
    const result = validateCreateTenant(
      makeFormData({ ...validTenant, email: "not-an-email" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.email).toContain("valid email");
  });

  it("passes when phone is omitted", () => {
    const data = { name: "Jane Doe", email: "jane@example.com" };
    const result = validateCreateTenant(makeFormData(data));
    expect(result.valid).toBe(true);
  });

  it("fails when phone has too few digits", () => {
    const result = validateCreateTenant(
      makeFormData({ ...validTenant, phone: "123" })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.phone).toContain("valid phone");
  });

  it("passes phone with dashes and parens (10+ digits)", () => {
    const result = validateCreateTenant(
      makeFormData({ ...validTenant, phone: "(555) 123-4567" })
    );
    expect(result.valid).toBe(true);
  });
});

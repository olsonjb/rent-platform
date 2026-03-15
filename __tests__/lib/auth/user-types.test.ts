import { describe, it, expect } from "vitest";
import {
  isUserType,
  getUserTypeFromMetadata,
  getUserRolesFromMetadata,
  getUserRolesFromClaims,
} from "@/lib/auth/user-types";

describe("isUserType", () => {
  it("returns true for 'landlord'", () => {
    expect(isUserType("landlord")).toBe(true);
  });

  it("returns true for 'renter'", () => {
    expect(isUserType("renter")).toBe(true);
  });

  it("returns false for invalid string", () => {
    expect(isUserType("admin")).toBe(false);
  });

  it("returns false for non-string", () => {
    expect(isUserType(42)).toBe(false);
    expect(isUserType(null)).toBe(false);
    expect(isUserType(undefined)).toBe(false);
  });
});

describe("getUserTypeFromMetadata", () => {
  it("returns userType from metadata.userType", () => {
    expect(getUserTypeFromMetadata({ userType: "landlord" })).toBe("landlord");
  });

  it("falls back to metadata.role", () => {
    expect(getUserTypeFromMetadata({ role: "renter" })).toBe("renter");
  });

  it("returns null for missing keys", () => {
    expect(getUserTypeFromMetadata({})).toBeNull();
  });

  it("returns null for non-object", () => {
    expect(getUserTypeFromMetadata(null)).toBeNull();
    expect(getUserTypeFromMetadata("string")).toBeNull();
  });

  it("returns null for invalid userType value", () => {
    expect(getUserTypeFromMetadata({ userType: "admin" })).toBeNull();
  });
});

describe("getUserRolesFromMetadata", () => {
  it("returns roles from metadata.roles array", () => {
    expect(getUserRolesFromMetadata({ roles: ["landlord", "renter"] })).toEqual([
      "landlord",
      "renter",
    ]);
  });

  it("filters out invalid roles", () => {
    expect(getUserRolesFromMetadata({ roles: ["landlord", "admin", "renter"] })).toEqual([
      "landlord",
      "renter",
    ]);
  });

  it("falls back to single userType as role", () => {
    expect(getUserRolesFromMetadata({ userType: "landlord" })).toEqual(["landlord"]);
  });

  it("returns empty array for non-object", () => {
    expect(getUserRolesFromMetadata(null)).toEqual([]);
  });

  it("deduplicates roles", () => {
    expect(getUserRolesFromMetadata({ roles: ["landlord", "landlord"] })).toEqual(["landlord"]);
  });
});

describe("getUserRolesFromClaims", () => {
  it("extracts roles from user_metadata", () => {
    const claims = { user_metadata: { userType: "landlord" } };
    expect(getUserRolesFromClaims(claims)).toEqual(["landlord"]);
  });

  it("combines roles from user_metadata and app_metadata", () => {
    const claims = {
      user_metadata: { userType: "landlord" },
      app_metadata: { userType: "renter" },
    };
    const roles = getUserRolesFromClaims(claims);
    expect(roles).toContain("landlord");
    expect(roles).toContain("renter");
  });

  it("returns empty array for non-object claims", () => {
    expect(getUserRolesFromClaims(null)).toEqual([]);
    expect(getUserRolesFromClaims(undefined)).toEqual([]);
  });
});

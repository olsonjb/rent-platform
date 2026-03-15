import { describe, it, expect } from "vitest";
import {
  getRequiredUserTypeForPath,
  canAccessPathForUserType,
  canAccessPathForUserRoles,
  getHomeRouteForUserType,
  getHomeRouteForUserRoles,
} from "@/lib/auth/authorization";

describe("getRequiredUserTypeForPath", () => {
  it("returns 'landlord' for /landlord paths", () => {
    expect(getRequiredUserTypeForPath("/landlord/dashboard")).toBe("landlord");
  });

  it("returns 'renter' for /renter paths", () => {
    expect(getRequiredUserTypeForPath("/renter/dashboard")).toBe("renter");
  });

  it("returns null for non-role paths", () => {
    expect(getRequiredUserTypeForPath("/")).toBeNull();
    expect(getRequiredUserTypeForPath("/protected")).toBeNull();
    expect(getRequiredUserTypeForPath("/sign-in")).toBeNull();
  });

  it("matches exact prefix", () => {
    expect(getRequiredUserTypeForPath("/landlord")).toBe("landlord");
  });
});

describe("canAccessPathForUserType", () => {
  it("allows landlord to access /landlord paths", () => {
    expect(canAccessPathForUserType("/landlord/dashboard", "landlord")).toBe(true);
  });

  it("denies renter from /landlord paths", () => {
    expect(canAccessPathForUserType("/landlord/dashboard", "renter")).toBe(false);
  });

  it("allows any type for unprotected paths", () => {
    expect(canAccessPathForUserType("/protected", "landlord")).toBe(true);
    expect(canAccessPathForUserType("/protected", "renter")).toBe(true);
  });
});

describe("canAccessPathForUserRoles", () => {
  it("allows access when roles include required type", () => {
    expect(canAccessPathForUserRoles("/landlord/dashboard", ["landlord"])).toBe(true);
  });

  it("denies access when roles don't include required type", () => {
    expect(canAccessPathForUserRoles("/landlord/dashboard", ["renter"])).toBe(false);
  });

  it("allows multi-role user to access landlord path", () => {
    expect(canAccessPathForUserRoles("/landlord/settings", ["landlord", "renter"])).toBe(true);
  });

  it("allows any roles for unprotected paths", () => {
    expect(canAccessPathForUserRoles("/", [])).toBe(true);
  });
});

describe("getHomeRouteForUserType", () => {
  it("returns /landlord/dashboard for landlord", () => {
    expect(getHomeRouteForUserType("landlord")).toBe("/landlord/dashboard");
  });

  it("returns /renter/dashboard for renter", () => {
    expect(getHomeRouteForUserType("renter")).toBe("/renter/dashboard");
  });
});

describe("getHomeRouteForUserRoles", () => {
  it("returns first role's home route", () => {
    expect(getHomeRouteForUserRoles(["landlord"])).toBe("/landlord/dashboard");
    expect(getHomeRouteForUserRoles(["renter"])).toBe("/renter/dashboard");
  });

  it("returns /protected for empty roles", () => {
    expect(getHomeRouteForUserRoles([])).toBe("/protected");
  });
});

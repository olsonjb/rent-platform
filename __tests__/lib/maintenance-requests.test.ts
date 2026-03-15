import { describe, it, expect } from "vitest";
import {
  isMaintenanceRequestLocation,
  isMaintenanceRequestUrgency,
  isMaintenanceRequestEntryPermission,
  isMaintenanceRequestStatus,
  MAINTENANCE_REQUEST_LOCATIONS,
  MAINTENANCE_REQUEST_URGENCIES,
  MAINTENANCE_REQUEST_ENTRY_PERMISSIONS,
  MAINTENANCE_REQUEST_STATUSES,
} from "@/lib/maintenance-requests";

describe("isMaintenanceRequestLocation", () => {
  it("returns true for all valid locations", () => {
    for (const loc of MAINTENANCE_REQUEST_LOCATIONS) {
      expect(isMaintenanceRequestLocation(loc)).toBe(true);
    }
  });

  it("returns false for invalid location", () => {
    expect(isMaintenanceRequestLocation("garage")).toBe(false);
  });

  it("returns false for non-string", () => {
    expect(isMaintenanceRequestLocation(42)).toBe(false);
    expect(isMaintenanceRequestLocation(null)).toBe(false);
    expect(isMaintenanceRequestLocation(undefined)).toBe(false);
  });
});

describe("isMaintenanceRequestUrgency", () => {
  it("returns true for all valid urgencies", () => {
    for (const urgency of MAINTENANCE_REQUEST_URGENCIES) {
      expect(isMaintenanceRequestUrgency(urgency)).toBe(true);
    }
  });

  it("returns false for invalid urgency", () => {
    expect(isMaintenanceRequestUrgency("critical")).toBe(false);
  });

  it("returns false for non-string", () => {
    expect(isMaintenanceRequestUrgency(123)).toBe(false);
  });
});

describe("isMaintenanceRequestEntryPermission", () => {
  it("returns true for all valid permissions", () => {
    for (const perm of MAINTENANCE_REQUEST_ENTRY_PERMISSIONS) {
      expect(isMaintenanceRequestEntryPermission(perm)).toBe(true);
    }
  });

  it("returns false for invalid permission", () => {
    expect(isMaintenanceRequestEntryPermission("no-entry")).toBe(false);
  });

  it("returns false for non-string", () => {
    expect(isMaintenanceRequestEntryPermission(true)).toBe(false);
  });
});

describe("isMaintenanceRequestStatus", () => {
  it("returns true for all valid statuses", () => {
    for (const status of MAINTENANCE_REQUEST_STATUSES) {
      expect(isMaintenanceRequestStatus(status)).toBe(true);
    }
  });

  it("returns false for invalid status", () => {
    expect(isMaintenanceRequestStatus("cancelled")).toBe(false);
  });

  it("returns false for non-string", () => {
    expect(isMaintenanceRequestStatus({})).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateIdempotencyKey } from "@/lib/chat/handle-maintenance";

// Mock external dependencies
vi.mock("@/lib/maintenance-review-worker", () => ({
  triggerMaintenanceReviewProcessingInBackground: vi.fn(),
}));

vi.mock("@/lib/twilio/sms", () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
  buildLandlordSms: vi.fn().mockReturnValue("test sms"),
}));

describe("generateIdempotencyKey", () => {
  it("produces a consistent hash for the same inputs", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    const key1 = generateIdempotencyKey("tenant-1", "Leaking faucet", date);
    const key2 = generateIdempotencyKey("tenant-1", "Leaking faucet", date);
    expect(key1).toBe(key2);
  });

  it("produces different hashes for different tenants", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    const key1 = generateIdempotencyKey("tenant-1", "Leaking faucet", date);
    const key2 = generateIdempotencyKey("tenant-2", "Leaking faucet", date);
    expect(key1).not.toBe(key2);
  });

  it("produces different hashes for different issues", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    const key1 = generateIdempotencyKey("tenant-1", "Leaking faucet", date);
    const key2 = generateIdempotencyKey("tenant-1", "Broken window", date);
    expect(key1).not.toBe(key2);
  });

  it("produces different hashes for different dates", () => {
    const key1 = generateIdempotencyKey(
      "tenant-1",
      "Leaking faucet",
      new Date("2026-03-15T12:00:00Z")
    );
    const key2 = generateIdempotencyKey(
      "tenant-1",
      "Leaking faucet",
      new Date("2026-03-16T12:00:00Z")
    );
    expect(key1).not.toBe(key2);
  });

  it("normalizes issue text (case insensitive)", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    const key1 = generateIdempotencyKey("tenant-1", "LEAKING FAUCET", date);
    const key2 = generateIdempotencyKey("tenant-1", "leaking faucet", date);
    expect(key1).toBe(key2);
  });

  it("normalizes whitespace in issue text", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    const key1 = generateIdempotencyKey("tenant-1", "leaking  faucet", date);
    const key2 = generateIdempotencyKey("tenant-1", "leaking faucet", date);
    expect(key1).toBe(key2);
  });

  it("trims issue text", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    const key1 = generateIdempotencyKey("tenant-1", "  leaking faucet  ", date);
    const key2 = generateIdempotencyKey("tenant-1", "leaking faucet", date);
    expect(key1).toBe(key2);
  });

  it("returns a 64-character hex string (sha256)", () => {
    const key = generateIdempotencyKey("tenant-1", "test", new Date());
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  it("same calendar day in different timezones produces same key", () => {
    // Both are on 2026-03-15 in UTC
    const key1 = generateIdempotencyKey(
      "tenant-1",
      "test",
      new Date("2026-03-15T01:00:00Z")
    );
    const key2 = generateIdempotencyKey(
      "tenant-1",
      "test",
      new Date("2026-03-15T23:00:00Z")
    );
    expect(key1).toBe(key2);
  });
});

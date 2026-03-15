import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  normalizeConfidence,
  sanitizeCostEstimate,
  parseEstimateJson,
  buildEstimatePrompt,
  buildPlacesQuery,
  getMaxRetries,
  getDefaultBatchSize,
} from "@/lib/maintenance-review";
import type { CostEstimate, MaintenanceRequestContext } from "@/lib/maintenance-review";

const baseContext: MaintenanceRequestContext = {
  id: "mr-1",
  issue: "Leaking faucet",
  details: "Kitchen faucet dripping constantly",
  location: "kitchen",
  urgency: "standard",
  unit: "101",
  contact_phone: "+15551234567",
  created_at: "2025-01-15T00:00:00Z",
  tenant_name: "Jane Doe",
  tenant_phone: "+15559876543",
  property_name: "Maple Apartments",
  property_address: "456 Maple Ave, SLC, UT 84101",
};

const validEstimate: CostEstimate = {
  trade: "plumbing",
  severity: "low",
  estimated_cost_min: 75,
  estimated_cost_max: 200,
  confidence: 0.85,
  summary: "Standard faucet repair or replacement",
};

describe("normalizeConfidence", () => {
  it("returns value unchanged when between 0 and 1", () => {
    expect(normalizeConfidence(0.5)).toBe(0.5);
  });

  it("clamps negative values to 0", () => {
    expect(normalizeConfidence(-0.3)).toBe(0);
  });

  it("clamps values above 1 to 1", () => {
    expect(normalizeConfidence(1.5)).toBe(1);
  });

  it("rounds to 3 decimal places", () => {
    expect(normalizeConfidence(0.12345)).toBe(0.123);
  });

  it("handles 0 and 1 exactly", () => {
    expect(normalizeConfidence(0)).toBe(0);
    expect(normalizeConfidence(1)).toBe(1);
  });
});

describe("sanitizeCostEstimate", () => {
  it("rounds cost values and normalizes confidence", () => {
    const result = sanitizeCostEstimate({
      ...validEstimate,
      estimated_cost_min: 74.7,
      estimated_cost_max: 200.3,
    });
    expect(result.estimated_cost_min).toBe(75);
    expect(result.estimated_cost_max).toBe(200);
  });

  it("ensures max is at least min", () => {
    const result = sanitizeCostEstimate({
      ...validEstimate,
      estimated_cost_min: 300,
      estimated_cost_max: 100,
    });
    expect(result.estimated_cost_max).toBeGreaterThanOrEqual(result.estimated_cost_min);
  });

  it("clamps negative min to 0", () => {
    const result = sanitizeCostEstimate({
      ...validEstimate,
      estimated_cost_min: -50,
      estimated_cost_max: 100,
    });
    expect(result.estimated_cost_min).toBe(0);
  });
});

describe("parseEstimateJson", () => {
  it("parses valid JSON with all required fields", () => {
    const result = parseEstimateJson(JSON.stringify(validEstimate));
    expect(result.trade).toBe("plumbing");
    expect(result.severity).toBe("low");
  });

  it("throws on missing required fields", () => {
    const partial = { trade: "plumbing" };
    expect(() => parseEstimateJson(JSON.stringify(partial))).toThrow(
      "Anthropic response did not match maintenance estimate schema",
    );
  });

  it("throws on invalid severity", () => {
    const bad = { ...validEstimate, severity: "extreme" };
    expect(() => parseEstimateJson(JSON.stringify(bad))).toThrow(
      "Anthropic response severity was invalid",
    );
  });

  it("throws on invalid JSON", () => {
    expect(() => parseEstimateJson("not json")).toThrow();
  });

  it("sanitizes the parsed estimate", () => {
    const raw = { ...validEstimate, estimated_cost_min: -10, confidence: 1.5 };
    const result = parseEstimateJson(JSON.stringify(raw));
    expect(result.estimated_cost_min).toBe(0);
    expect(result.confidence).toBe(1);
  });
});

describe("buildEstimatePrompt", () => {
  it("includes issue title and property address", () => {
    const prompt = buildEstimatePrompt(baseContext);
    expect(prompt).toContain("Leaking faucet");
    expect(prompt).toContain("456 Maple Ave");
  });

  it("handles null details and location", () => {
    const prompt = buildEstimatePrompt({
      ...baseContext,
      details: null,
      location: null,
    });
    expect(prompt).toContain("Not provided");
  });
});

describe("buildPlacesQuery", () => {
  it("builds query from trade and address", () => {
    const query = buildPlacesQuery(baseContext, "plumbing");
    expect(query).toBe("plumbing repair near 456 Maple Ave, SLC, UT 84101");
  });
});

describe("getMaxRetries", () => {
  const originalEnv = process.env.MAINTENANCE_REVIEW_MAX_RETRIES;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.MAINTENANCE_REVIEW_MAX_RETRIES;
    } else {
      process.env.MAINTENANCE_REVIEW_MAX_RETRIES = originalEnv;
    }
  });

  it("returns default 3 when env not set", () => {
    delete process.env.MAINTENANCE_REVIEW_MAX_RETRIES;
    expect(getMaxRetries()).toBe(3);
  });

  it("returns configured value", () => {
    process.env.MAINTENANCE_REVIEW_MAX_RETRIES = "5";
    expect(getMaxRetries()).toBe(5);
  });

  it("returns default for non-numeric value", () => {
    process.env.MAINTENANCE_REVIEW_MAX_RETRIES = "abc";
    expect(getMaxRetries()).toBe(3);
  });

  it("returns default for zero", () => {
    process.env.MAINTENANCE_REVIEW_MAX_RETRIES = "0";
    expect(getMaxRetries()).toBe(3);
  });
});

describe("getDefaultBatchSize", () => {
  const originalEnv = process.env.MAINTENANCE_REVIEW_BATCH_SIZE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.MAINTENANCE_REVIEW_BATCH_SIZE;
    } else {
      process.env.MAINTENANCE_REVIEW_BATCH_SIZE = originalEnv;
    }
  });

  it("returns default 10 when env not set", () => {
    delete process.env.MAINTENANCE_REVIEW_BATCH_SIZE;
    expect(getDefaultBatchSize()).toBe(10);
  });

  it("returns configured value", () => {
    process.env.MAINTENANCE_REVIEW_BATCH_SIZE = "20";
    expect(getDefaultBatchSize()).toBe(20);
  });

  it("returns default for invalid value", () => {
    process.env.MAINTENANCE_REVIEW_BATCH_SIZE = "xyz";
    expect(getDefaultBatchSize()).toBe(10);
  });
});

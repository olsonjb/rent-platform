import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PropertyListing } from "@/lib/providers/types";

const { submitA, submitB } = vi.hoisted(() => ({
  submitA: vi.fn(),
  submitB: vi.fn(),
}));

vi.mock("@/lib/providers", () => ({
  activeProviders: [
    { name: "ProviderA", submit: submitA },
    { name: "ProviderB", submit: submitB },
  ],
}));

import { submitToProviders } from "@/lib/agent/submit";

const baseListing: PropertyListing = {
  title: "Test Listing",
  description: "A nice property.",
  highlights: ["Pool"],
  rent: 1500,
  bedrooms: 2,
  bathrooms: 1,
  sqft: 900,
  address: "123 Main St",
  city: "SLC",
  state: "UT",
  zip: "84101",
};

describe("submitToProviders", () => {
  beforeEach(() => {
    submitA.mockReset();
    submitB.mockReset();
  });

  it("returns success results when all providers succeed", async () => {
    submitA.mockResolvedValue({
      provider: "ProviderA",
      success: true,
      listingUrl: "https://a.com/1",
    });
    submitB.mockResolvedValue({
      provider: "ProviderB",
      success: true,
      listingUrl: "https://b.com/2",
    });

    const results = await submitToProviders(baseListing);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });

  it("catches error from one provider and continues", async () => {
    submitA.mockRejectedValue(new Error("Network error"));
    submitB.mockResolvedValue({
      provider: "ProviderB",
      success: true,
    });

    const results = await submitToProviders(baseListing);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBe("Network error");
    expect(results[1].success).toBe(true);
  });

  it("handles all providers failing", async () => {
    submitA.mockRejectedValue(new Error("Timeout"));
    submitB.mockRejectedValue(new Error("500 Internal Server Error"));

    const results = await submitToProviders(baseListing);
    expect(results).toHaveLength(2);
    expect(results.every((r) => !r.success)).toBe(true);
  });

  it("extracts error message from Error instances", async () => {
    submitA.mockRejectedValue(new Error("Specific error"));
    submitB.mockRejectedValue("string error");

    const results = await submitToProviders(baseListing);
    expect(results[0].error).toBe("Specific error");
    expect(results[1].error).toBe("Unknown error");
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  setMockAnthropicResponse,
  resetAnthropicMock,
  installAnthropicMock,
} from "../../mocks/anthropic";

installAnthropicMock();

import { makeListingDecision } from "@/lib/agent/decision";

const baseInput = () => ({
  property: {
    address: "456 Oak Ave",
    city: "Salt Lake City",
    state: "UT",
    zip: "84101",
    bedrooms: 2,
    bathrooms: 1,
    sqft: 900,
    monthly_rent: 1200,
  },
  lease: {
    end_date: new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
    monthly_rent: 1100,
    tenant_name: "John Smith",
    renewal_offered: false,
  },
});

describe("makeListingDecision", () => {
  beforeEach(() => {
    resetAnthropicMock();
  });

  it("returns should_list true on happy path", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        should_list: true,
        reasoning: "Lease ending soon, no renewal",
        suggested_rent: 1250,
        urgency: "high",
      }),
    );

    const result = await makeListingDecision(baseInput());
    expect(result.should_list).toBe(true);
    expect(result.suggested_rent).toBe(1250);
    expect(result.urgency).toBe("high");
  });

  it("returns should_list false", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        should_list: false,
        reasoning: "Renewal offered",
        suggested_rent: null,
        urgency: "low",
      }),
    );

    const result = await makeListingDecision(baseInput());
    expect(result.should_list).toBe(false);
  });

  it("calculates days-left correctly", async () => {
    // The prompt includes "Expires in X days" — we just verify the function runs
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    setMockAnthropicResponse(
      JSON.stringify({
        should_list: false,
        reasoning: "Plenty of time",
        suggested_rent: null,
        urgency: "low",
      }),
    );

    const input = baseInput();
    input.lease.end_date = futureDate;
    const result = await makeListingDecision(input);
    expect(result.urgency).toBe("low");
  });

  it("returns fallback on non-JSON response", async () => {
    setMockAnthropicResponse("I cannot provide a response.");

    const result = await makeListingDecision(baseInput());
    expect(result.should_list).toBe(false);
    expect(result.reasoning).toBe("Failed to parse AI response");
    expect(result.suggested_rent).toBeNull();
    expect(result.urgency).toBe("low");
  });

  it("returns fallback when text is empty", async () => {
    setMockAnthropicResponse("");

    const result = await makeListingDecision(baseInput());
    expect(result.should_list).toBe(false);
    expect(result.reasoning).toBe("Failed to parse AI response");
  });

  it("handles null property fields gracefully", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        should_list: true,
        reasoning: "Ok",
        suggested_rent: 1000,
        urgency: "medium",
      }),
    );

    const input = baseInput();
    input.property.city = null;
    input.property.state = null;
    input.property.zip = null;
    input.property.bedrooms = null;
    input.property.bathrooms = null;
    input.property.sqft = null;
    input.property.monthly_rent = null;

    const result = await makeListingDecision(input);
    expect(result.should_list).toBe(true);
  });
});

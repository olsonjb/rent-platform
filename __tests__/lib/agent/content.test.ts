import { describe, it, expect, beforeEach } from "vitest";
import {
  setMockAnthropicResponse,
  resetAnthropicMock,
  installAnthropicMock,
} from "../../mocks/anthropic";

installAnthropicMock();

import { generateListingContent } from "@/lib/agent/content";

const baseInput = () => ({
  property: {
    address: "789 Elm St",
    city: "Provo",
    state: "UT",
    zip: "84601",
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1200,
  },
  suggestedRent: 1500,
});

describe("generateListingContent", () => {
  beforeEach(() => {
    resetAnthropicMock();
  });

  it("returns parsed content on happy path", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        title: "Charming 3BR in Provo",
        description: "Beautiful home near campus.",
        highlights: ["Updated kitchen", "Mountain views", "Parking included"],
      }),
    );

    const result = await generateListingContent(baseInput());
    expect(result.title).toBe("Charming 3BR in Provo");
    expect(result.description).toContain("Beautiful home");
    expect(result.highlights).toHaveLength(3);
  });

  it("returns fallback on parse failure", async () => {
    setMockAnthropicResponse("Sorry, I cannot help.");

    const result = await generateListingContent(baseInput());
    expect(result.title).toBe("789 Elm St for Rent");
    expect(result.description).toBe("Rental property available.");
    expect(result.highlights).toEqual([]);
  });

  it("handles null property fields gracefully", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        title: "Nice Place",
        description: "A great place to live.",
        highlights: ["Central location"],
      }),
    );

    const input = baseInput();
    input.property.city = null;
    input.property.state = null;
    input.property.zip = null;
    input.property.bedrooms = null;
    input.property.bathrooms = null;
    input.property.sqft = null;

    const result = await generateListingContent(input);
    expect(result.title).toBe("Nice Place");
  });
});

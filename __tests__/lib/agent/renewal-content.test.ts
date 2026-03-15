import { describe, it, expect, beforeEach } from "vitest";
import {
  setMockAnthropicResponse,
  resetAnthropicMock,
  installAnthropicMock,
} from "../../mocks/anthropic";
import type { RenewalRecommendation } from "@/lib/types";

installAnthropicMock();

import { generateRenewalOffer } from "@/lib/agent/renewal-content";

const baseInput = () => ({
  evaluation: {
    recommendation: "renew-adjust" as RenewalRecommendation,
    suggested_rent: 1300,
    reasoning: "Good tenant, market adjustment warranted.",
    tenant_score: 8,
    factors: {
      payment_history: "On-time payments",
      maintenance_requests: "1 standard request",
      tenure_length: "12 months — stable",
      communication: "Responsive",
    },
  },
  lease: {
    start_date: "2025-03-15",
    end_date: "2026-03-15",
    monthly_rent: 1200,
  },
  tenant: { name: "Jane Smith" },
  property: {
    address: "456 Oak Ave",
    city: "Salt Lake City" as string | null,
    state: "UT" as string | null,
  },
  newEndDate: "2027-03-15",
  newRent: 1300,
});

describe("generateRenewalOffer", () => {
  beforeEach(() => {
    resetAnthropicMock();
  });

  it("returns generated offer letter from JSON response", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        offer_letter:
          "Dear Jane Smith,\n\nWe are pleased to offer you a lease renewal at 456 Oak Ave.\n\nNew Terms:\n- Monthly Rent: $1,300\n- Lease End: 2027-03-15\n\nPlease respond within 14 days.\n\nBest regards,\nProperty Management",
      }),
    );

    const result = await generateRenewalOffer(baseInput());
    expect(result).toContain("Jane Smith");
    expect(result).toContain("$1,300");
    expect(result).toContain("14 days");
  });

  it("returns raw text when JSON extraction fails", async () => {
    setMockAnthropicResponse(
      "Dear Jane Smith, we'd like to offer you a renewal. Respond within 14 days.",
    );

    const result = await generateRenewalOffer(baseInput());
    expect(result).toContain("Jane Smith");
    expect(result).toContain("14 days");
  });

  it("returns fallback offer when AI returns empty string", async () => {
    setMockAnthropicResponse("");

    const result = await generateRenewalOffer(baseInput());
    expect(result).toContain("Jane Smith");
    expect(result).toContain("456 Oak Ave");
    expect(result).toContain("$1300");
  });

  it("handles same-rent renewal correctly", async () => {
    const input = baseInput();
    input.newRent = 1200;
    input.evaluation.recommendation = "renew-same";

    setMockAnthropicResponse(
      JSON.stringify({
        offer_letter:
          "Dear Jane Smith, we're happy to renew your lease at the same rate of $1,200/month.",
      }),
    );

    const result = await generateRenewalOffer(input);
    expect(result).toContain("$1,200");
  });

  it("handles null city/state gracefully", async () => {
    const input = baseInput();
    input.property.city = null;
    input.property.state = null;

    setMockAnthropicResponse(
      JSON.stringify({
        offer_letter: "Dear Jane Smith, your lease renewal offer is ready.",
      }),
    );

    const result = await generateRenewalOffer(input);
    expect(result).toContain("Jane Smith");
  });
});

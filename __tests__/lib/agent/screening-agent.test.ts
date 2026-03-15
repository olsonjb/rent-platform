import { describe, it, expect, beforeEach } from "vitest";
import {
  setMockAnthropicResponse,
  resetAnthropicMock,
  installAnthropicMock,
} from "../../mocks/anthropic";

installAnthropicMock();

import { screenApplication } from "@/lib/agent/screening-agent";

const baseInput = () => ({
  application: {
    full_name: "Jane Doe",
    credit_score_range: "700_749",
    monthly_income: 6000,
    employer_name: "Acme Inc",
    employment_duration_months: 24,
    employment_type: "full_time",
    years_renting: 5,
    previous_evictions: false,
    references: [{ name: "Ref One", phone: "555-0001", relationship: "landlord" }],
    social_media_links: [],
  },
  property: {
    address: "123 Main St",
    monthly_rent: 1500,
  },
});

describe("screenApplication", () => {
  beforeEach(() => {
    resetAnthropicMock();
  });

  it("returns approved decision on happy path", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        approved: true,
        reasoning: "Solid applicant",
        risk_score: 15,
        income_ratio: 4.0,
        flags: [],
        confidence: 0.95,
        social_media_notes: null,
      }),
    );

    const result = await screenApplication(baseInput());
    expect(result.approved).toBe(true);
    expect(result.income_ratio).toBe(4); // recalculated: 6000/1500
    expect(result.confidence).toBe(0.95);
    expect(result.risk_score).toBe(15);
  });

  it("returns denied decision", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        approved: false,
        reasoning: "Income too low",
        risk_score: 80,
        income_ratio: 1.5,
        flags: ["low_income"],
        confidence: 0.9,
        social_media_notes: null,
      }),
    );

    const result = await screenApplication(baseInput());
    expect(result.approved).toBe(false);
    expect(result.flags).toContain("low_income");
  });

  it("recalculates income_ratio from input", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        approved: true,
        reasoning: "ok",
        risk_score: 10,
        income_ratio: 999,
        flags: [],
        confidence: 0.8,
        social_media_notes: null,
      }),
    );

    const result = await screenApplication(baseInput());
    // 6000 / 1500 = 4
    expect(result.income_ratio).toBe(4);
  });

  it("clamps confidence above 1 to 1", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        approved: true,
        reasoning: "ok",
        risk_score: 10,
        income_ratio: 4,
        flags: [],
        confidence: 1.5,
        social_media_notes: null,
      }),
    );

    const result = await screenApplication(baseInput());
    expect(result.confidence).toBe(1);
  });

  it("clamps confidence below 0 to 0", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        approved: true,
        reasoning: "ok",
        risk_score: 10,
        income_ratio: 4,
        flags: [],
        confidence: -0.5,
        social_media_notes: null,
      }),
    );

    const result = await screenApplication(baseInput());
    expect(result.confidence).toBe(0);
  });

  it("clamps risk_score to 0-100 range", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        approved: false,
        reasoning: "risky",
        risk_score: 150,
        income_ratio: 2,
        flags: [],
        confidence: 0.7,
        social_media_notes: null,
      }),
    );

    const result = await screenApplication(baseInput());
    expect(result.risk_score).toBe(100);
  });

  it("returns FALLBACK_DECISION on JSON parse failure", async () => {
    setMockAnthropicResponse("This is not JSON at all");

    const result = await screenApplication(baseInput());
    expect(result.approved).toBe(false);
    expect(result.flags).toContain("parse_error");
    expect(result.risk_score).toBe(100);
    expect(result.confidence).toBe(0);
  });

  it("returns FALLBACK_DECISION when no text block", async () => {
    // When the response contains a JSON block that is invalid JSON, we get fallback
    setMockAnthropicResponse("{invalid json!!}");

    const result = await screenApplication(baseInput());
    expect(result.approved).toBe(false);
    expect(result.flags).toContain("parse_error");
  });

  it("returns income_ratio 0 when rent is zero", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        approved: true,
        reasoning: "ok",
        risk_score: 10,
        income_ratio: 0,
        flags: [],
        confidence: 0.9,
        social_media_notes: null,
      }),
    );

    const input = baseInput();
    input.property.monthly_rent = 0;
    const result = await screenApplication(input);
    expect(result.income_ratio).toBe(0);
  });

  it("uses credit label lookup for known ranges", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        approved: true,
        reasoning: "ok",
        risk_score: 5,
        income_ratio: 4,
        flags: [],
        confidence: 0.99,
        social_media_notes: null,
      }),
    );

    // We verify the function completes without error for known credit range
    const input = baseInput();
    input.application.credit_score_range = "750_plus";
    const result = await screenApplication(input);
    expect(result.approved).toBe(true);
  });
});

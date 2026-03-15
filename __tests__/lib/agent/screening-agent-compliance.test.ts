import { describe, it, expect, beforeEach } from "vitest";
import {
  setMockAnthropicResponse,
  resetAnthropicMock,
  getLastAnthropicCall,
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
    employment_type: "full_time" as const,
    years_renting: 5,
    previous_evictions: false,
    references: [{ name: "Ref One", phone: "555-0001", relationship: "landlord" }],
    social_media_links: ["https://twitter.com/janedoe", "https://facebook.com/janedoe"],
  },
  property: {
    address: "123 Main St",
    monthly_rent: 1500,
  },
});

describe("screening-agent Fair Housing compliance", () => {
  beforeEach(() => {
    resetAnthropicMock();
  });

  it("does NOT include social_media_links in the prompt sent to Claude", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        approved: true,
        reasoning: "Good applicant",
        risk_score: 10,
        income_ratio: 4,
        flags: [],
        confidence: 0.95,
        social_media_notes: null,
      }),
    );

    await screenApplication(baseInput());

    const call = getLastAnthropicCall();
    expect(call).toBeTruthy();
    const messages = call!.messages as { content: string }[];
    const promptText = messages[0].content;

    expect(promptText).not.toContain("twitter.com");
    expect(promptText).not.toContain("facebook.com");
    expect(promptText).not.toContain("Social Media Links");
  });

  it("does NOT include applicant full_name in the prompt", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        approved: true,
        reasoning: "ok",
        risk_score: 10,
        income_ratio: 4,
        flags: [],
        confidence: 0.9,
        social_media_notes: null,
      }),
    );

    await screenApplication(baseInput());

    const call = getLastAnthropicCall();
    const messages = call!.messages as { content: string }[];
    const promptText = messages[0].content;

    expect(promptText).not.toContain("Jane Doe");
  });

  it("includes Fair Housing compliance instructions in the prompt", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        approved: true,
        reasoning: "ok",
        risk_score: 10,
        income_ratio: 4,
        flags: [],
        confidence: 0.9,
        social_media_notes: null,
      }),
    );

    await screenApplication(baseInput());

    const call = getLastAnthropicCall();
    const messages = call!.messages as { content: string }[];
    const promptText = messages[0].content;

    expect(promptText).toContain("FAIR HOUSING COMPLIANCE");
    expect(promptText).toContain("race");
    expect(promptText).toContain("religion");
    expect(promptText).toContain("national origin");
    expect(promptText).toContain("familial status");
    expect(promptText).toContain("disability");
  });

  it("always returns social_media_notes as null", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        approved: true,
        reasoning: "ok",
        risk_score: 10,
        income_ratio: 4,
        flags: [],
        confidence: 0.9,
        social_media_notes: "Some social media analysis", // AI might still return this
      }),
    );

    const result = await screenApplication(baseInput());
    expect(result.social_media_notes).toBeNull();
  });

  it("states recommendation is advisory, not final", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        approved: true,
        reasoning: "ok",
        risk_score: 10,
        income_ratio: 4,
        flags: [],
        confidence: 0.9,
        social_media_notes: null,
      }),
    );

    await screenApplication(baseInput());

    const call = getLastAnthropicCall();
    const messages = call!.messages as { content: string }[];
    const promptText = messages[0].content;

    expect(promptText).toContain("advisory");
    expect(promptText).toContain("NOT a final decision");
  });

  it("does not include property address in the prompt", async () => {
    setMockAnthropicResponse(
      JSON.stringify({
        approved: true,
        reasoning: "ok",
        risk_score: 10,
        income_ratio: 4,
        flags: [],
        confidence: 0.9,
        social_media_notes: null,
      }),
    );

    await screenApplication(baseInput());

    const call = getLastAnthropicCall();
    const messages = call!.messages as { content: string }[];
    const promptText = messages[0].content;

    // Property address is removed to prevent neighborhood-based discrimination
    expect(promptText).not.toContain("123 Main St");
  });
});

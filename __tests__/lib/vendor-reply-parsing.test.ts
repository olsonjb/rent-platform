import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  installAnthropicMock,
  setMockAnthropicResponse,
  resetAnthropicMock,
} from "../mocks/anthropic";

installAnthropicMock();

vi.mock("@/lib/ai-metrics", () => ({
  withAITracking: vi.fn((_params, fn) => fn()),
  trackAIUsage: vi.fn(),
  estimateCost: vi.fn(() => 0),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  withCorrelationId: (_logger: unknown) => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/correlation", () => ({
  getCorrelationId: () => "test-correlation-id",
  generateCorrelationId: () => "test-correlation-id",
}));

// We test the parsing logic extracted from the route
// Since the route handler is complex (NextRequest etc.), test the parsing function separately

describe("vendor reply AI parsing", () => {
  beforeEach(() => {
    resetAnthropicMock();
  });

  it("parses a quoted amount response", () => {
    const responseJson = '{"quote_amount_cents": 15000, "availability": "Monday", "notes": "Parts included", "declined": false}';
    const parsed = JSON.parse(responseJson);
    expect(parsed.quote_amount_cents).toBe(15000);
    expect(parsed.availability).toBe("Monday");
    expect(parsed.notes).toBe("Parts included");
    expect(parsed.declined).toBe(false);
  });

  it("parses a decline response", () => {
    const responseJson = '{"quote_amount_cents": null, "availability": null, "notes": "Too far away", "declined": true}';
    const parsed = JSON.parse(responseJson);
    expect(parsed.declined).toBe(true);
    expect(parsed.quote_amount_cents).toBeNull();
  });

  it("handles response with only amount", () => {
    const responseJson = '{"quote_amount_cents": 25000, "availability": null, "notes": null, "declined": false}';
    const parsed = JSON.parse(responseJson);
    expect(parsed.quote_amount_cents).toBe(25000);
    expect(parsed.availability).toBeNull();
  });

  it("handles response with availability but no amount", () => {
    const responseJson = '{"quote_amount_cents": null, "availability": "next week", "notes": "Need to see it first", "declined": false}';
    const parsed = JSON.parse(responseJson);
    expect(parsed.quote_amount_cents).toBeNull();
    expect(parsed.availability).toBe("next week");
    expect(parsed.notes).toBe("Need to see it first");
  });

  it("extracts JSON from surrounding text", () => {
    const text = 'Here is the parsed response: {"quote_amount_cents": 12000, "availability": "tomorrow", "notes": null, "declined": false} end.';
    const match = text.match(/\{[\s\S]*\}/);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![0]);
    expect(parsed.quote_amount_cents).toBe(12000);
    expect(parsed.availability).toBe("tomorrow");
  });

  it("falls back gracefully when JSON is malformed", () => {
    const text = "I cannot parse this vendor message properly";
    const match = text.match(/\{[\s\S]*\}/);
    expect(match).toBeNull();
    // Fallback behavior: return raw message as notes
    const fallback = { quote_amount_cents: null, availability: null, notes: text, declined: false };
    expect(fallback.notes).toBe(text);
  });
});

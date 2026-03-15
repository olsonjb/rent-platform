import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSupabase } = vi.hoisted(() => {
  const queryResult = { data: null as unknown, error: null as unknown };

  const builder = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => Promise.resolve(queryResult)),
  };

  Object.defineProperty(builder, "then", {
    value: (resolve: (v: { data: unknown; error: unknown }) => void) => resolve(queryResult),
    writable: true,
    configurable: true,
  });

  return {
    mockSupabase: {
      client: builder,
      queryResult,
      setData(data: unknown) {
        queryResult.data = data;
        queryResult.error = null;
      },
      setError(error: { message: string }) {
        queryResult.data = null;
        queryResult.error = error;
      },
      reset() {
        queryResult.data = null;
        queryResult.error = null;
        for (const fn of Object.values(builder)) {
          if (typeof fn === "function" && "mockClear" in fn) {
            (fn as ReturnType<typeof vi.fn>).mockClear();
          }
        }
      },
    },
  };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => mockSupabase.client),
}));

const { mockScreenResult } = vi.hoisted(() => ({
  mockScreenResult: {
    approved: true,
    reasoning: "Good applicant",
    risk_score: 15,
    income_ratio: 4.0,
    flags: [],
    confidence: 0.95,
    social_media_notes: null,
  },
}));

vi.mock("@/lib/agent/screening-agent", () => ({
  screenApplication: vi.fn().mockImplementation(async () => ({ ...mockScreenResult })),
}));

// Mock audit log to verify it's called
const mockLogScreeningEvent = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/screening/audit-log", () => ({
  logScreeningEvent: (...args: unknown[]) => mockLogScreeningEvent(...args),
}));

import { processQueuedApplicationScreenings } from "@/lib/application-screening";

describe("application-screening compliance", () => {
  beforeEach(() => {
    mockSupabase.reset();
    mockLogScreeningEvent.mockClear();
  });

  it("sets status to ai_reviewed instead of approved/denied", async () => {
    const job = { id: "job-1", application_id: "app-1", attempt_count: 0 };

    let callCount = 0;
    mockSupabase.client.select.mockImplementation(function (this: typeof mockSupabase.client) {
      callCount++;
      if (callCount === 1) {
        mockSupabase.queryResult.data = [job];
        mockSupabase.queryResult.error = null;
      } else if (callCount === 2) {
        mockSupabase.queryResult.data = [{ id: "job-1", application_id: "app-1", attempt_count: 0 }];
        mockSupabase.queryResult.error = null;
      } else if (callCount === 3) {
        mockSupabase.queryResult.data = {
          id: "app-1",
          full_name: "Jane Doe",
          credit_score_range: "700_749",
          monthly_income: 6000,
          employer_name: "Acme",
          employment_duration_months: 24,
          employment_type: "full_time",
          years_renting: 5,
          previous_evictions: false,
          references: [],
          social_media_links: [],
          properties: { address: "123 Main St", monthly_rent: 1500 },
        };
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    await processQueuedApplicationScreenings();

    // Verify update calls — one for "screening", one for "ai_reviewed"
    const updateCalls = mockSupabase.client.update.mock.calls;
    const aiReviewedCall = updateCalls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).status === "ai_reviewed",
    );
    expect(aiReviewedCall).toBeDefined();

    // Verify AI does NOT set approved or denied status directly
    const approvedCall = updateCalls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).status === "approved",
    );
    const deniedCall = updateCalls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).status === "denied",
    );
    expect(approvedCall).toBeUndefined();
    expect(deniedCall).toBeUndefined();
  });

  it("stores ai_recommendation and ai_recommendation_confidence", async () => {
    const job = { id: "job-1", application_id: "app-1", attempt_count: 0 };

    let callCount = 0;
    mockSupabase.client.select.mockImplementation(function (this: typeof mockSupabase.client) {
      callCount++;
      if (callCount === 1) {
        mockSupabase.queryResult.data = [job];
        mockSupabase.queryResult.error = null;
      } else if (callCount === 2) {
        mockSupabase.queryResult.data = [{ id: "job-1", application_id: "app-1", attempt_count: 0 }];
        mockSupabase.queryResult.error = null;
      } else if (callCount === 3) {
        mockSupabase.queryResult.data = {
          id: "app-1",
          full_name: "Test User",
          credit_score_range: "700_749",
          monthly_income: 6000,
          employer_name: "Acme",
          employment_duration_months: 24,
          employment_type: "full_time",
          years_renting: 5,
          previous_evictions: false,
          references: [],
          social_media_links: [],
          properties: { address: "456 Oak Ave", monthly_rent: 1500 },
        };
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    await processQueuedApplicationScreenings();

    const updateCalls = mockSupabase.client.update.mock.calls;
    const aiReviewedCall = updateCalls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).status === "ai_reviewed",
    );
    expect(aiReviewedCall).toBeDefined();
    const payload = aiReviewedCall![0] as Record<string, unknown>;
    expect(payload.ai_recommendation).toBe("approved");
    expect(payload.ai_recommendation_confidence).toBe(0.95);
  });

  it("logs screening_started and ai_decision audit events", async () => {
    const job = { id: "job-1", application_id: "app-1", attempt_count: 0 };

    let callCount = 0;
    mockSupabase.client.select.mockImplementation(function (this: typeof mockSupabase.client) {
      callCount++;
      if (callCount === 1) {
        mockSupabase.queryResult.data = [job];
        mockSupabase.queryResult.error = null;
      } else if (callCount === 2) {
        mockSupabase.queryResult.data = [{ id: "job-1", application_id: "app-1", attempt_count: 0 }];
        mockSupabase.queryResult.error = null;
      } else if (callCount === 3) {
        mockSupabase.queryResult.data = {
          id: "app-1",
          full_name: "Test User",
          credit_score_range: "700_749",
          monthly_income: 6000,
          employer_name: "Acme",
          employment_duration_months: 24,
          employment_type: "full_time",
          years_renting: 5,
          previous_evictions: false,
          references: [],
          social_media_links: [],
          properties: { address: "789 Elm", monthly_rent: 1500 },
        };
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    await processQueuedApplicationScreenings();

    // Verify audit log calls
    expect(mockLogScreeningEvent).toHaveBeenCalledWith("app-1", "screening_started", {});
    expect(mockLogScreeningEvent).toHaveBeenCalledWith("app-1", "ai_decision", expect.objectContaining({
      recommendation: "approved",
      confidence: 0.95,
    }));
  });
});

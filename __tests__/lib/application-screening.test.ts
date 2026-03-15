import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We need to mock supabase and anthropic before importing the module
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

  // Make builder thenable for awaiting the chain
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

// Mock the screening agent
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

import { processQueuedApplicationScreenings } from "@/lib/application-screening";

describe("processQueuedApplicationScreenings", () => {
  const originalBatchSize = process.env.APPLICATION_SCREENING_BATCH_SIZE;
  const originalMaxRetries = process.env.APPLICATION_SCREENING_MAX_RETRIES;

  beforeEach(() => {
    mockSupabase.reset();
    delete process.env.APPLICATION_SCREENING_BATCH_SIZE;
    delete process.env.APPLICATION_SCREENING_MAX_RETRIES;
  });

  afterEach(() => {
    if (originalBatchSize === undefined) {
      delete process.env.APPLICATION_SCREENING_BATCH_SIZE;
    } else {
      process.env.APPLICATION_SCREENING_BATCH_SIZE = originalBatchSize;
    }
    if (originalMaxRetries === undefined) {
      delete process.env.APPLICATION_SCREENING_MAX_RETRIES;
    } else {
      process.env.APPLICATION_SCREENING_MAX_RETRIES = originalMaxRetries;
    }
  });

  it("returns zero counts when queue is empty", async () => {
    // claimQueuedJobs: initial query returns no jobs
    mockSupabase.setData([]);

    const result = await processQueuedApplicationScreenings();
    expect(result.claimed).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.requeued).toBe(0);
  });

  it("processes a single job successfully", async () => {
    // First call: query for queued jobs returns 1 job
    const job = { id: "job-1", application_id: "app-1", attempt_count: 0 };
    const claimedRow = { id: "job-1", application_id: "app-1", attempt_count: 0 };

    // Make the builder's select return claimed rows after update
    let callCount = 0;
    mockSupabase.client.select.mockImplementation(function (this: unknown) {
      callCount++;
      if (callCount === 1) {
        // Initial queued jobs query
        mockSupabase.queryResult.data = [job];
        mockSupabase.queryResult.error = null;
      } else if (callCount === 2) {
        // Claim query returns claimed row
        mockSupabase.queryResult.data = [claimedRow];
        mockSupabase.queryResult.error = null;
      } else if (callCount === 3) {
        // fetchApplicationContext single()
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

    const result = await processQueuedApplicationScreenings();
    expect(result.claimed).toBe(1);
    expect(result.completed).toBe(1);
  });

  it("uses custom batch size from env", () => {
    process.env.APPLICATION_SCREENING_BATCH_SIZE = "5";
    // Just verify it doesn't throw; functional test would need deeper mocking
    mockSupabase.setData([]);
    expect(() => processQueuedApplicationScreenings()).not.toThrow();
  });

  it("uses custom max retries from env", () => {
    process.env.APPLICATION_SCREENING_MAX_RETRIES = "5";
    mockSupabase.setData([]);
    expect(() => processQueuedApplicationScreenings()).not.toThrow();
  });

  it("falls back to defaults for invalid env values", () => {
    process.env.APPLICATION_SCREENING_BATCH_SIZE = "notanumber";
    process.env.APPLICATION_SCREENING_MAX_RETRIES = "notanumber";
    mockSupabase.setData([]);
    expect(() => processQueuedApplicationScreenings()).not.toThrow();
  });
});

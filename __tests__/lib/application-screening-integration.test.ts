import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSupabase, mockScreenApplication } = vi.hoisted(() => {
  const queryResult = { data: null as unknown, error: null as unknown };

  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chainMethods = [
    "from", "select", "insert", "update", "upsert", "delete",
    "eq", "neq", "lt", "lte", "gt", "gte", "in", "is",
    "order", "limit", "range", "filter", "match", "not", "or",
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnThis();
  }
  builder.single = vi.fn().mockImplementation(() => Promise.resolve(queryResult));

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
    },
    mockScreenApplication: vi.fn(),
  };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => mockSupabase.client),
}));

vi.mock("@/lib/agent/screening-agent", () => ({
  screenApplication: mockScreenApplication,
}));

import { processQueuedApplicationScreenings } from "@/lib/application-screening";

const fakeJob = { id: "job-1", application_id: "app-1", attempt_count: 0 };

const fakeApplicationData = {
  id: "app-1",
  full_name: "Jane Doe",
  credit_score_range: "700_749",
  monthly_income: 6000,
  employer_name: "Acme",
  employment_duration_months: 24,
  employment_type: "full_time",
  years_renting: 5,
  previous_evictions: false,
  references: [{ name: "Ref", phone: "555", relationship: "landlord" }],
  social_media_links: ["https://twitter.com/jane"],
  properties: { address: "123 Main St", monthly_rent: 1500 },
};

describe("processQueuedApplicationScreenings - branch coverage", () => {
  beforeEach(() => {
    mockScreenApplication.mockReset();
    for (const fn of Object.values(mockSupabase.client)) {
      if (typeof fn === "function" && "mockClear" in fn) {
        (fn as ReturnType<typeof vi.fn>).mockClear().mockReturnThis();
      }
    }
    mockSupabase.client.single.mockImplementation(() =>
      Promise.resolve(mockSupabase.queryResult),
    );
  });

  it("processes a job and saves approved result", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 3) {
        mockSupabase.queryResult.data = fakeApplicationData;
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    mockScreenApplication.mockResolvedValue({
      approved: true,
      reasoning: "Good",
      risk_score: 10,
      income_ratio: 4,
      flags: [],
      confidence: 0.95,
      social_media_notes: null,
    });

    const result = await processQueuedApplicationScreenings();
    expect(result.completed).toBe(1);
    expect(mockScreenApplication).toHaveBeenCalled();
  });

  it("processes denied result", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 3) {
        mockSupabase.queryResult.data = fakeApplicationData;
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    mockScreenApplication.mockResolvedValue({
      approved: false,
      reasoning: "Bad credit",
      risk_score: 80,
      income_ratio: 2,
      flags: ["low_credit"],
      confidence: 0.85,
      social_media_notes: null,
    });

    const result = await processQueuedApplicationScreenings();
    expect(result.completed).toBe(1);
  });

  it("requeues job on screening error when under max retries", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [{ ...fakeJob, attempt_count: 0 }];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [{ ...fakeJob, attempt_count: 0 }];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 3) {
        mockSupabase.queryResult.data = fakeApplicationData;
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    mockScreenApplication.mockRejectedValue(new Error("AI timeout"));

    const result = await processQueuedApplicationScreenings();
    expect(result.requeued).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("marks job as failed when at max retries", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [{ ...fakeJob, attempt_count: 2 }]; // max is 3
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [{ ...fakeJob, attempt_count: 2 }];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 3) {
        mockSupabase.queryResult.data = fakeApplicationData;
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    mockScreenApplication.mockRejectedValue(new Error("Persistent error"));

    const result = await processQueuedApplicationScreenings();
    expect(result.failed).toBe(1);
    expect(result.requeued).toBe(0);
  });

  it("handles claim race (no rows returned from claim update)", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        // Claim returns empty — another worker grabbed it
        mockSupabase.queryResult.data = [];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    const result = await processQueuedApplicationScreenings();
    expect(result.claimed).toBe(0);
  });

  it("handles null references and social_media_links in application data", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 3) {
        mockSupabase.queryResult.data = {
          ...fakeApplicationData,
          employer_name: null,
          employment_duration_months: null,
          employment_type: null,
          references: null,
          social_media_links: null,
          properties: [{ address: "456 Oak", monthly_rent: null }],
        };
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    mockScreenApplication.mockResolvedValue({
      approved: true,
      reasoning: "OK",
      risk_score: 15,
      income_ratio: 3,
      flags: [],
      confidence: 0.9,
      social_media_notes: null,
    });

    const result = await processQueuedApplicationScreenings();
    expect(result.completed).toBe(1);
  });

  it("handles missing property relation", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 3) {
        mockSupabase.queryResult.data = {
          ...fakeApplicationData,
          properties: null,
        };
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    // Should throw on missing property, which gets caught and requeued
    const result = await processQueuedApplicationScreenings();
    expect(result.requeued).toBe(1);
  });

  it("uses custom batchSize parameter", async () => {
    mockSupabase.setData([]);
    const result = await processQueuedApplicationScreenings(3);
    expect(result.claimed).toBe(0);
  });
});

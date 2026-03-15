import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSupabase, mockAnthropicCreate, mockFetchFn } = vi.hoisted(() => {
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
    mockAnthropicCreate: vi.fn(),
    mockFetchFn: vi.fn(),
  };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => mockSupabase.client),
}));

vi.mock("@anthropic-ai/sdk", () => {
  function MockAnthropic() {
    return { messages: { create: mockAnthropicCreate } };
  }
  return { default: MockAnthropic };
});

// Stub global fetch
vi.stubGlobal("fetch", mockFetchFn);

import { processQueuedMaintenanceReviews } from "@/lib/maintenance-review";

const fakeJob = { id: "job-1", maintenance_request_id: "mr-1", attempt_count: 0 };

const fakeMaintenanceRequest = {
  id: "mr-1",
  issue: "Broken window",
  details: "Window won't close",
  location: "bedroom",
  urgency: "standard",
  unit: "201",
  contact_phone: "+15551234567",
  created_at: "2025-01-15T00:00:00Z",
  tenants: {
    name: "Jane Doe",
    phone: "+15559876543",
    properties: {
      name: "Oak Towers",
      address: "789 Oak Rd, SLC, UT 84102",
    },
  },
};

const fakeEstimateResponse = JSON.stringify({
  trade: "glass_repair",
  severity: "medium",
  estimated_cost_min: 150,
  estimated_cost_max: 400,
  confidence: 0.8,
  summary: "Window glass replacement needed",
});

describe("processQueuedMaintenanceReviews integration", () => {
  beforeEach(() => {
    mockAnthropicCreate.mockReset();
    mockFetchFn.mockReset();
    for (const fn of Object.values(mockSupabase.client)) {
      if (typeof fn === "function" && "mockClear" in fn) {
        (fn as ReturnType<typeof vi.fn>).mockClear().mockReturnThis();
      }
    }
    mockSupabase.client.single.mockImplementation(() =>
      Promise.resolve(mockSupabase.queryResult),
    );
  });

  it("returns zero counts when no queued jobs", async () => {
    mockSupabase.setData([]);
    const result = await processQueuedMaintenanceReviews();
    expect(result.claimed).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.requeued).toBe(0);
  });

  it("processes a single job through the full pipeline", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        // claimQueuedJobs: initial query
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        // claimQueuedJobs: claim update+select
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    // fetchMaintenanceRequestContext: .single()
    let singleCallCount = 0;
    mockSupabase.client.single.mockImplementation(() => {
      singleCallCount++;
      if (singleCallCount === 1) {
        return Promise.resolve({ data: fakeMaintenanceRequest, error: null });
      }
      return Promise.resolve(mockSupabase.queryResult);
    });

    // Anthropic response for estimateCost
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: fakeEstimateResponse }],
    });

    // Google Places text search
    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [{ place_id: "place-1" }],
      }),
    });

    // Google Places details
    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "OK",
        result: {
          name: "ABC Glass Repair",
          formatted_phone_number: "555-0199",
          website: "https://abcglass.com",
          formatted_address: "100 Elm St",
          url: "https://maps.google.com/abc",
          rating: 4.5,
          user_ratings_total: 120,
        },
      }),
    });

    const result = await processQueuedMaintenanceReviews(5);
    expect(result.claimed).toBe(1);
    expect(result.completed).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("handles error and requeues job when attempt_count < max", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [{ ...fakeJob, attempt_count: 0 }];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [{ ...fakeJob, attempt_count: 0 }];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    // fetchMaintenanceRequestContext fails
    mockSupabase.client.single.mockImplementation(() => {
      return Promise.resolve({ data: null, error: { message: "Not found" } });
    });

    const result = await processQueuedMaintenanceReviews();
    expect(result.claimed).toBe(1);
    expect(result.requeued).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("marks job as failed when attempt_count >= max_retries", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [{ ...fakeJob, attempt_count: 2 }];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [{ ...fakeJob, attempt_count: 2 }];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    // fetchMaintenanceRequestContext fails
    mockSupabase.client.single.mockImplementation(() => {
      return Promise.resolve({ data: null, error: { message: "Not found" } });
    });

    const result = await processQueuedMaintenanceReviews();
    expect(result.claimed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.requeued).toBe(0);
  });

  it("handles empty Places results gracefully", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    let singleCallCount = 0;
    mockSupabase.client.single.mockImplementation(() => {
      singleCallCount++;
      if (singleCallCount === 1) {
        return Promise.resolve({ data: fakeMaintenanceRequest, error: null });
      }
      return Promise.resolve(mockSupabase.queryResult);
    });

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: fakeEstimateResponse }],
    });

    // Empty Places results
    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ZERO_RESULTS", results: [] }),
    });

    const result = await processQueuedMaintenanceReviews();
    expect(result.claimed).toBe(1);
    expect(result.completed).toBe(1);
  });

  it("handles Places API error", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [fakeJob];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    let singleCallCount = 0;
    mockSupabase.client.single.mockImplementation(() => {
      singleCallCount++;
      if (singleCallCount === 1) {
        return Promise.resolve({ data: fakeMaintenanceRequest, error: null });
      }
      return Promise.resolve(mockSupabase.queryResult);
    });

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: fakeEstimateResponse }],
    });

    // Places API returns non-ok
    mockFetchFn.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    // This should cause a requeue since findNearbyVendors throws
    const result = await processQueuedMaintenanceReviews();
    expect(result.claimed).toBe(1);
    expect(result.requeued).toBe(1);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoist all mocks
const { mockSupabase, mockEvaluate } = vi.hoisted(() => {
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
    mockEvaluate: vi.fn(),
  };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => mockSupabase.client),
}));

vi.mock("@/lib/agent/renewal-agent", () => ({
  evaluateTenantForRenewal: mockEvaluate,
}));

import { GET } from "@/app/api/cron/check-renewals/route";
import { NextRequest } from "next/server";

function makeRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new NextRequest("http://localhost/api/cron/check-renewals", { headers });
}

describe("GET /api/cron/check-renewals", () => {
  beforeEach(() => {
    mockEvaluate.mockReset();
    for (const fn of Object.values(mockSupabase.client)) {
      if (typeof fn === "function" && "mockClear" in fn) {
        (fn as ReturnType<typeof vi.fn>).mockClear().mockReturnThis();
      }
    }
    mockSupabase.client.single.mockImplementation(() =>
      Promise.resolve(mockSupabase.queryResult),
    );
    vi.stubEnv("CRON_SECRET", "test-secret");
  });

  it("returns 401 without auth header", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong auth header", async () => {
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("returns empty results when no expiring leases", async () => {
    mockSupabase.setData([]);

    const res = await GET(makeRequest("Bearer test-secret"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.processed).toBe(0);
    expect(body.data.results).toEqual([]);
  });

  it("processes expiring lease and creates renewal offer", async () => {
    const fakeLease = {
      id: "lease-1",
      landlord_id: "landlord-1",
      tenant_id: "tenant-1",
      end_date: new Date(Date.now() + 50 * 86400000).toISOString().split("T")[0],
      monthly_rent: 1200,
    };

    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        // Expiring leases query
        mockSupabase.queryResult.data = [fakeLease];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        // Existing offer check
        mockSupabase.queryResult.data = [];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    // Mock insert to resolve (no .select().single() after insert in cron)
    mockSupabase.client.insert.mockImplementation(function () {
      mockSupabase.queryResult.data = null;
      mockSupabase.queryResult.error = null;
      return mockSupabase.client;
    });

    mockEvaluate.mockResolvedValue({
      recommendation: "renew-adjust",
      suggested_rent: 1250,
      reasoning: "Market adjustment warranted.",
      tenant_score: 8,
      factors: {
        payment_history: "On-time",
        maintenance_requests: "Minimal",
        tenure_length: "12 months",
        communication: "Responsive",
      },
    });

    const res = await GET(makeRequest("Bearer test-secret"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.processed).toBe(1);
    expect(body.data.results[0].recommendation).toBe("renew-adjust");
    expect(body.data.results[0].suggestedRent).toBe(1250);
    expect(mockEvaluate).toHaveBeenCalledWith("lease-1");
  });

  it("skips lease that already has a pending offer (deduplication)", async () => {
    const fakeLease = {
      id: "lease-1",
      landlord_id: "landlord-1",
      tenant_id: "tenant-1",
      end_date: new Date(Date.now() + 50 * 86400000).toISOString().split("T")[0],
      monthly_rent: 1200,
    };

    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [fakeLease];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        // Existing offer found
        mockSupabase.queryResult.data = [{ id: "existing-offer" }];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    const res = await GET(makeRequest("Bearer test-secret"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.processed).toBe(0);
    expect(mockEvaluate).not.toHaveBeenCalled();
  });

  it("handles evaluation error gracefully", async () => {
    const fakeLease = {
      id: "lease-1",
      landlord_id: "landlord-1",
      tenant_id: "tenant-1",
      end_date: new Date(Date.now() + 50 * 86400000).toISOString().split("T")[0],
      monthly_rent: 1200,
    };

    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [fakeLease];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    mockEvaluate.mockRejectedValue(new Error("AI timeout"));

    const res = await GET(makeRequest("Bearer test-secret"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.processed).toBe(1);
    expect(body.data.results[0].error).toContain("AI timeout");
  });
});

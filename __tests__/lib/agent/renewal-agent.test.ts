import { describe, it, expect, beforeEach } from "vitest";
import {
  setMockAnthropicResponse,
  resetAnthropicMock,
  installAnthropicMock,
} from "../../mocks/anthropic";
import { vi } from "vitest";

// Hoist Supabase mock
const { mockSupabase } = vi.hoisted(() => {
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
  };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => mockSupabase.client),
}));

installAnthropicMock();

import { evaluateTenantForRenewal } from "@/lib/agent/renewal-agent";

const fakeLease = {
  id: "lease-1",
  landlord_id: "landlord-1",
  property_id: "prop-1",
  tenant_id: "tenant-1",
  start_date: "2025-03-15",
  end_date: "2026-03-15",
  monthly_rent: 1200,
  properties: {
    address: "123 Main St",
    city: "SLC",
    state: "UT",
  },
  landlord_tenants: {
    name: "Tenant One",
    email: "tenant@example.com",
  },
};

describe("evaluateTenantForRenewal", () => {
  beforeEach(() => {
    resetAnthropicMock();
    for (const fn of Object.values(mockSupabase.client)) {
      if (typeof fn === "function" && "mockClear" in fn) {
        (fn as ReturnType<typeof vi.fn>).mockClear().mockReturnThis();
      }
    }
    mockSupabase.client.single.mockImplementation(() =>
      Promise.resolve(mockSupabase.queryResult),
    );
  });

  it("returns renewal evaluation for renew-adjust recommendation", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        // Lease query
        mockSupabase.queryResult.data = fakeLease;
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        // Maintenance requests query
        mockSupabase.queryResult.data = [
          { id: "mr-1", urgency: "standard" },
        ];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    setMockAnthropicResponse(
      JSON.stringify({
        recommendation: "renew-adjust",
        suggested_rent: 1250,
        reasoning: "Good tenant, market adjustment warranted.",
        tenant_score: 8,
        factors: {
          payment_history: "No data available",
          maintenance_requests: "1 standard request — reasonable",
          tenure_length: "12 months — stable",
          communication: "No data available",
        },
      }),
    );

    const result = await evaluateTenantForRenewal("lease-1");
    expect(result.recommendation).toBe("renew-adjust");
    expect(result.suggested_rent).toBe(1250);
    expect(result.tenant_score).toBe(8);
    expect(result.factors.maintenance_requests).toContain("standard");
  });

  it("returns renew-same recommendation", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = fakeLease;
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    setMockAnthropicResponse(
      JSON.stringify({
        recommendation: "renew-same",
        suggested_rent: 1200,
        reasoning: "Excellent tenant, no adjustment needed.",
        tenant_score: 9,
        factors: {
          payment_history: "No data available",
          maintenance_requests: "No requests — excellent",
          tenure_length: "12 months — stable",
          communication: "No data available",
        },
      }),
    );

    const result = await evaluateTenantForRenewal("lease-1");
    expect(result.recommendation).toBe("renew-same");
    expect(result.suggested_rent).toBe(1200);
  });

  it("returns do-not-renew recommendation for problematic tenant", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = fakeLease;
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [
          { id: "mr-1", urgency: "habitability" },
          { id: "mr-2", urgency: "habitability" },
          { id: "mr-3", urgency: "standard" },
          { id: "mr-4", urgency: "standard" },
          { id: "mr-5", urgency: "standard" },
        ];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    setMockAnthropicResponse(
      JSON.stringify({
        recommendation: "do-not-renew",
        suggested_rent: 0,
        reasoning: "High maintenance burden with multiple habitability issues.",
        tenant_score: 3,
        factors: {
          payment_history: "No data available",
          maintenance_requests: "5 requests, 2 habitability — high burden",
          tenure_length: "12 months",
          communication: "No data available",
        },
      }),
    );

    const result = await evaluateTenantForRenewal("lease-1");
    expect(result.recommendation).toBe("do-not-renew");
    expect(result.tenant_score).toBe(3);
  });

  it("returns fallback on non-JSON AI response", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = fakeLease;
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    setMockAnthropicResponse("I cannot evaluate this tenant.");

    const result = await evaluateTenantForRenewal("lease-1");
    expect(result.recommendation).toBe("renew-same");
    expect(result.suggested_rent).toBe(1200);
  });

  it("throws when lease not found", async () => {
    mockSupabase.client.single.mockImplementation(() =>
      Promise.resolve({ data: null, error: { message: "Not found" } }),
    );

    await expect(evaluateTenantForRenewal("nonexistent")).rejects.toThrow("Lease not found");
  });
});

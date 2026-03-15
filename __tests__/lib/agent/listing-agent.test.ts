import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoist all mocks before they're referenced inside vi.mock factories
const { mockSupabase, mockDecision, mockContent, mockSubmit } = vi.hoisted(() => {
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

  // Make builder thenable
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
    mockDecision: vi.fn(),
    mockContent: vi.fn(),
    mockSubmit: vi.fn(),
  };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => mockSupabase.client),
}));

vi.mock("@/lib/agent/decision", () => ({
  makeListingDecision: mockDecision,
}));

vi.mock("@/lib/agent/content", () => ({
  generateListingContent: mockContent,
}));

vi.mock("@/lib/agent/submit", () => ({
  submitToProviders: mockSubmit,
}));

import { runListingAgent } from "@/lib/agent/listing-agent";

const fakeLease = {
  id: "lease-1",
  end_date: new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
  monthly_rent: 1200,
  renewal_offered: false,
  property_id: "prop-1",
  properties: {
    id: "prop-1",
    address: "123 Main St",
    city: "SLC",
    state: "UT",
    zip: "84101",
    bedrooms: 2,
    bathrooms: 1,
    sqft: 900,
    monthly_rent: 1200,
  },
  landlord_tenants: {
    name: "Tenant One",
    email: "tenant@example.com",
  },
};

describe("runListingAgent", () => {
  beforeEach(() => {
    mockDecision.mockReset();
    mockContent.mockReset();
    mockSubmit.mockReset();
    // Reset all supabase builder mocks
    for (const fn of Object.values(mockSupabase.client)) {
      if (typeof fn === "function" && "mockClear" in fn) {
        (fn as ReturnType<typeof vi.fn>).mockClear().mockReturnThis();
      }
    }
    mockSupabase.client.single.mockImplementation(() =>
      Promise.resolve(mockSupabase.queryResult),
    );
  });

  it("returns empty array when no expiring leases", async () => {
    mockSupabase.setData([]);
    const results = await runListingAgent();
    expect(results).toEqual([]);
  });

  it("returns empty array when query errors", async () => {
    mockSupabase.setError({ message: "DB error" });
    const results = await runListingAgent();
    expect(results).toEqual([]);
  });

  it("processes lease with should_list=false and skips content/submit", async () => {
    // First call: expiring leases query
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        // Expiring leases query (ends with .gte, no .single)
        mockSupabase.queryResult.data = [fakeLease];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        // Existing listing check
        mockSupabase.queryResult.data = [];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    mockDecision.mockResolvedValue({
      should_list: false,
      reasoning: "Renewal offered",
      suggested_rent: null,
      urgency: "low",
    });

    const results = await runListingAgent();
    expect(results).toHaveLength(1);
    expect(results[0].decision.should_list).toBe(false);
    expect(mockContent).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("processes lease with should_list=true through full pipeline", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [fakeLease];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        mockSupabase.queryResult.data = [];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 3) {
        // Insert .select("id").single()
        mockSupabase.queryResult.data = { id: "listing-1" };
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    mockDecision.mockResolvedValue({
      should_list: true,
      reasoning: "Lease ending soon",
      suggested_rent: 1300,
      urgency: "high",
    });

    mockContent.mockResolvedValue({
      title: "Nice Place",
      description: "A great rental.",
      highlights: ["Updated kitchen"],
    });

    mockSubmit.mockResolvedValue([
      { provider: "Zillow", success: true, listingUrl: "https://zillow.com/1" },
    ]);

    const results = await runListingAgent();
    expect(results).toHaveLength(1);
    expect(results[0].decision.should_list).toBe(true);
    expect(results[0].content?.title).toBe("Nice Place");
    expect(results[0].listingId).toBe("listing-1");
    expect(results[0].providerResults).toHaveLength(1);
  });

  it("skips lease that already has a listing", async () => {
    let selectCallCount = 0;
    mockSupabase.client.select.mockImplementation(function () {
      selectCallCount++;
      if (selectCallCount === 1) {
        mockSupabase.queryResult.data = [fakeLease];
        mockSupabase.queryResult.error = null;
      } else if (selectCallCount === 2) {
        // Existing listing found
        mockSupabase.queryResult.data = [{ id: "existing-listing" }];
        mockSupabase.queryResult.error = null;
      }
      return mockSupabase.client;
    });

    const results = await runListingAgent();
    expect(results).toHaveLength(0);
    expect(mockDecision).not.toHaveBeenCalled();
  });

  it("handles error during lease processing gracefully", async () => {
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

    mockDecision.mockRejectedValue(new Error("API timeout"));

    const results = await runListingAgent();
    expect(results).toHaveLength(1);
    expect(results[0].decision.should_list).toBe(false);
    expect(results[0].decision.reasoning).toContain("Agent error");
  });
});

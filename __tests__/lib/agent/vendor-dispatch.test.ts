import { describe, it, expect, vi, beforeEach } from "vitest";
import { installTwilioMock, mockMessagesCreate } from "../../mocks/twilio";

installTwilioMock();

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Inline supabase mock to avoid hoisting issues
const mockInsert = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/service", () => {
  const chainObj = {
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return Promise.resolve({ data: null, error: null });
    },
  };
  return {
    createServiceClient: () => ({
      from: (...args: unknown[]) => {
        mockFrom(...args);
        return chainObj;
      },
    }),
  };
});

import { buildOutreachMessage, dispatchVendors } from "@/lib/agent/vendor-dispatch";
import type { DispatchContext } from "@/lib/agent/vendor-dispatch";

const baseContext: DispatchContext = {
  maintenanceRequestId: "mr-1",
  issue: "Leaking faucet in kitchen",
  propertyAddress: "123 Main St, Austin TX 78701",
  propertyName: "Sunset Apartments",
  unit: "4B",
  trade: "plumbing",
  estimatedCostMin: 150,
  estimatedCostMax: 400,
  vendors: [
    {
      name: "Joe's Plumbing",
      phone: "+15551234567",
      website: "https://joesplumbing.com",
      address: "456 Oak Ave",
      rating: 4.5,
      user_ratings_total: 120,
    },
    {
      name: "Quick Fix Plumbing",
      phone: "+15559876543",
      website: null,
      address: "789 Elm St",
      rating: 4.2,
      user_ratings_total: 80,
    },
    {
      name: "No Phone Vendor",
      phone: null,
      website: null,
      address: null,
      rating: null,
      user_ratings_total: null,
    },
  ],
};

describe("buildOutreachMessage", () => {
  it("includes vendor name, trade, address, unit, issue, and cost range", () => {
    const msg = buildOutreachMessage(baseContext, "Joe's Plumbing");
    expect(msg).toContain("Joe's Plumbing");
    expect(msg).toContain("plumbing");
    expect(msg).toContain("123 Main St, Austin TX 78701");
    expect(msg).toContain("Unit 4B");
    expect(msg).toContain("Leaking faucet in kitchen");
    expect(msg).toContain("$150-$400");
    expect(msg).toContain("reply with your quote");
  });

  it("generates different messages for different trades", () => {
    const hvacContext = { ...baseContext, trade: "HVAC", issue: "AC not cooling" };
    const msg = buildOutreachMessage(hvacContext, "Cool Air Inc");
    expect(msg).toContain("HVAC");
    expect(msg).toContain("AC not cooling");
  });

  it("generates messages for electrical trade", () => {
    const electricContext = { ...baseContext, trade: "electrician", issue: "Outlet sparking" };
    const msg = buildOutreachMessage(electricContext, "Spark Electric");
    expect(msg).toContain("electrician");
    expect(msg).toContain("Outlet sparking");
  });
});

describe("dispatchVendors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessagesCreate.mockResolvedValue({ sid: "SM_mock" });
  });

  it("contacts only vendors with phone numbers", async () => {
    const count = await dispatchVendors(baseContext);
    // 2 vendors have phones, 1 does not
    expect(count).toBe(2);
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
  });

  it("limits to 3 vendors max", async () => {
    const manyVendors = {
      ...baseContext,
      vendors: Array.from({ length: 5 }, (_, i) => ({
        name: `Vendor ${i}`,
        phone: `+1555000000${i}`,
        website: null,
        address: null,
        rating: null,
        user_ratings_total: null,
      })),
    };
    const count = await dispatchVendors(manyVendors);
    expect(count).toBe(3);
    expect(mockMessagesCreate).toHaveBeenCalledTimes(3);
  });

  it("returns 0 when no vendors have phones", async () => {
    const noPhoneCtx = {
      ...baseContext,
      vendors: [{ name: "V1", phone: null, website: null, address: null, rating: null, user_ratings_total: null }],
    };
    const count = await dispatchVendors(noPhoneCtx);
    expect(count).toBe(0);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("handles SMS send failure gracefully", async () => {
    mockMessagesCreate.mockRejectedValueOnce(new Error("Twilio error"));
    mockMessagesCreate.mockResolvedValueOnce({ sid: "SM_ok" });
    const count = await dispatchVendors(baseContext);
    // First one fails, second succeeds
    expect(count).toBe(1);
  });

  it("inserts outreach records into vendor_outreach table", async () => {
    await dispatchVendors(baseContext);
    expect(mockFrom).toHaveBeenCalledWith("vendor_outreach");
    expect(mockInsert).toHaveBeenCalledTimes(2);
    // Check the first insert has expected fields
    const firstInsert = mockInsert.mock.calls[0][0];
    expect(firstInsert.vendor_name).toBe("Joe's Plumbing");
    expect(firstInsert.maintenance_request_id).toBe("mr-1");
    expect(firstInsert.outreach_method).toBe("sms");
    expect(firstInsert.status).toBe("sent");
  });
});

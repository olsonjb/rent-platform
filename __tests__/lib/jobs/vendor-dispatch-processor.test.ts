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

// Use vi.hoisted to make variables available to hoisted vi.mock factories
const { mockTableData, mockUpdateCalls } = vi.hoisted(() => {
  const mockTableData: Record<string, { data: unknown; error: unknown }> = {};
  const mockUpdateCalls: Array<{ table: string; data: unknown }> = [];
  return { mockTableData, mockUpdateCalls };
});

vi.mock("@/lib/supabase/service", () => {
  return {
    createServiceClient: () => {
      let currentTable = "";

      const resolve = () => {
        const result = mockTableData[currentTable] ?? { data: null, error: null };
        return Promise.resolve(result);
      };

      const chain: Record<string, unknown> = {};
      chain.from = (table: string) => { currentTable = table; return chain; };
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.neq = () => chain;
      chain.lte = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.insert = () => chain;
      chain.update = (data: unknown) => { mockUpdateCalls.push({ table: currentTable, data }); return chain; };
      chain.single = resolve;
      chain.maybeSingle = resolve;
      // Make the chain itself thenable so `await supabase.from(...).select(...)...` works
      Object.defineProperty(chain, "then", {
        get() {
          return (cb: (v: unknown) => void) => cb(mockTableData[currentTable] ?? { data: null, error: null });
        },
        configurable: true,
      });

      return chain;
    },
  };
});

import { processQueuedVendorDispatches } from "@/lib/jobs/vendor-dispatch-processor";

describe("processQueuedVendorDispatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockTableData).forEach((k) => delete mockTableData[k]);
    mockUpdateCalls.length = 0;
    mockMessagesCreate.mockResolvedValue({ sid: "SM_mock" });
  });

  it("returns zero counts when no jobs are queued", async () => {
    mockTableData["vendor_dispatch_jobs"] = { data: [], error: null };
    const result = await processQueuedVendorDispatches(5);
    expect(result.claimed).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.requeued).toBe(0);
  });

  it("throws if unable to fetch queued jobs", async () => {
    mockTableData["vendor_dispatch_jobs"] = { data: null, error: { message: "DB error" } };
    await expect(processQueuedVendorDispatches(5)).rejects.toThrow(
      "Unable to fetch queued vendor dispatch jobs",
    );
  });
});

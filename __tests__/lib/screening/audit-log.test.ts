import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSupabase } = vi.hoisted(() => {
  const insertResult = { data: null as unknown, error: null as unknown };
  const selectResult = { data: null as unknown, error: null as unknown };

  let mode: "insert" | "select" = "select";

  const builder = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockImplementation(function (this: typeof builder) {
      mode = "insert";
      return this;
    }),
    select: vi.fn().mockImplementation(function (this: typeof builder) {
      mode = "select";
      return this;
    }),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  };

  Object.defineProperty(builder, "then", {
    value: (resolve: (v: { data: unknown; error: unknown }) => void) => {
      resolve(mode === "insert" ? insertResult : selectResult);
    },
    writable: true,
    configurable: true,
  });

  return {
    mockSupabase: {
      client: builder,
      insertResult,
      selectResult,
      setInsertSuccess() {
        insertResult.data = [{ id: "test-id" }];
        insertResult.error = null;
      },
      setInsertError(message: string) {
        insertResult.data = null;
        insertResult.error = { message };
      },
      setSelectData(data: unknown) {
        selectResult.data = data;
        selectResult.error = null;
      },
      setSelectError(message: string) {
        selectResult.data = null;
        selectResult.error = { message };
      },
      reset() {
        insertResult.data = null;
        insertResult.error = null;
        selectResult.data = null;
        selectResult.error = null;
        mode = "select";
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

import { logScreeningEvent, getApplicationAuditLog } from "@/lib/screening/audit-log";

describe("logScreeningEvent", () => {
  beforeEach(() => {
    mockSupabase.reset();
  });

  it("inserts an audit event with correct fields", async () => {
    mockSupabase.setInsertSuccess();

    await logScreeningEvent("app-1", "ai_decision", { recommendation: "approved" }, "actor-1");

    expect(mockSupabase.client.from).toHaveBeenCalledWith("screening_audit_log");
    expect(mockSupabase.client.insert).toHaveBeenCalledWith({
      application_id: "app-1",
      event_type: "ai_decision",
      event_data: { recommendation: "approved" },
      actor_id: "actor-1",
    });
  });

  it("sets actor_id to null when not provided", async () => {
    mockSupabase.setInsertSuccess();

    await logScreeningEvent("app-1", "screening_started", {});

    expect(mockSupabase.client.insert).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: null }),
    );
  });

  it("throws on insert error", async () => {
    mockSupabase.setInsertError("insert failed");

    await expect(
      logScreeningEvent("app-1", "submitted", {}),
    ).rejects.toThrow("Failed to log screening event");
  });
});

describe("getApplicationAuditLog", () => {
  beforeEach(() => {
    mockSupabase.reset();
  });

  it("returns audit entries for an application", async () => {
    const entries = [
      { id: "1", application_id: "app-1", event_type: "submitted", event_data: {}, actor_id: null, created_at: "2026-01-01" },
      { id: "2", application_id: "app-1", event_type: "ai_decision", event_data: { recommendation: "approved" }, actor_id: null, created_at: "2026-01-02" },
    ];
    mockSupabase.setSelectData(entries);

    const result = await getApplicationAuditLog("app-1");
    expect(result).toEqual(entries);
    expect(mockSupabase.client.eq).toHaveBeenCalledWith("application_id", "app-1");
    expect(mockSupabase.client.order).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("returns empty array when no data", async () => {
    mockSupabase.setSelectData(null);

    const result = await getApplicationAuditLog("app-1");
    expect(result).toEqual([]);
  });

  it("throws on select error", async () => {
    mockSupabase.setSelectError("select failed");

    await expect(getApplicationAuditLog("app-1")).rejects.toThrow("Failed to fetch audit log");
  });
});

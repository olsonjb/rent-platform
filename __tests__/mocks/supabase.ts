import { vi } from "vitest";

type QueryResult = { data: unknown; error: unknown };

/**
 * Creates a chainable mock Supabase client.
 * Every query-builder method returns `this` so chains like
 * `.from("x").select("y").eq("z", 1).single()` work out of the box.
 */
export function createMockSupabaseClient() {
  let _result: QueryResult = { data: null, error: null };

  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chainMethods = [
    "from",
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "neq",
    "lt",
    "lte",
    "gt",
    "gte",
    "in",
    "is",
    "order",
    "limit",
    "range",
    "filter",
    "match",
    "not",
    "or",
    "contains",
    "containedBy",
    "textSearch",
  ] as const;

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnThis();
  }

  // Terminal methods resolve with current result
  builder.single = vi.fn().mockImplementation(() => Promise.resolve(_result));
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(_result));
  builder.then = vi.fn().mockImplementation((resolve) => resolve(_result));

  // Make chainable methods return the builder (including terminal ones for chaining)
  // Override: after a chain ending in a non-terminal, `then` resolves so `await` works
  const proxy = new Proxy(builder, {
    get(target, prop: string) {
      if (prop === "then") {
        // Allow await on the builder itself
        return (resolve: (v: QueryResult) => void) => resolve(_result);
      }
      return target[prop];
    },
  });

  /** Set the data that the next query chain will resolve with. */
  function mockResolvedData(data: unknown) {
    _result = { data, error: null };
  }

  /** Set the error that the next query chain will resolve with. */
  function mockResolvedError(error: { message: string; code?: string }) {
    _result = { data: null, error };
  }

  return { client: proxy as unknown, builder, mockResolvedData, mockResolvedError };
}

/**
 * Install Supabase module mocks.
 * Call this inside a `beforeEach` or at the top of a test file.
 */
export function installSupabaseMock() {
  const mock = createMockSupabaseClient();

  vi.mock("@/lib/supabase/service", () => ({
    createServiceClient: vi.fn(() => mock.client),
  }));

  vi.mock("@/lib/supabase/client", () => ({
    createClient: vi.fn(() => mock.client),
  }));

  return mock;
}

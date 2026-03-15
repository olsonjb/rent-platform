import { vi } from "vitest";

const mockFetch = vi.fn();

export function installFetchMock() {
  vi.stubGlobal("fetch", mockFetch);
  return mockFetch;
}

/** Convenience: make fetch resolve with a single JSON response. */
export function mockFetchResponse(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

/** Convenience: mock a sequence of fetch responses in order. */
export function mockFetchSequence(responses: { body: unknown; status?: number }[]) {
  for (const r of responses) {
    mockFetchResponse(r.body, r.status ?? 200);
  }
}

export { mockFetch };

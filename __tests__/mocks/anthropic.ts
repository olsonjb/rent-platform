import { vi } from "vitest";

let _mockResponseText = "{}";
let _lastCall: Record<string, unknown> | null = null;

const messagesCreate = vi.fn().mockImplementation(async (params: Record<string, unknown>) => {
  _lastCall = params;
  return {
    content: [{ type: "text", text: _mockResponseText }],
  };
});

/** Set the text that the mock Anthropic client will return from messages.create. */
export function setMockAnthropicResponse(text: string) {
  _mockResponseText = text;
}

/** Get the params from the last messages.create call. */
export function getLastAnthropicCall(): Record<string, unknown> | null {
  return _lastCall;
}

/** Reset mock state between tests. */
export function resetAnthropicMock() {
  _mockResponseText = "{}";
  _lastCall = null;
  messagesCreate.mockClear();
}

/** The mock constructor — returned from vi.mock("@anthropic-ai/sdk"). */
export function installAnthropicMock() {
  vi.mock("@anthropic-ai/sdk", () => {
    const MockAnthropic = vi.fn().mockImplementation(() => ({
      messages: { create: messagesCreate },
    }));
    return { default: MockAnthropic };
  });
}

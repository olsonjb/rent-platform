import { vi } from "vitest";

export const mockMessagesCreate = vi.fn().mockResolvedValue({ sid: "SM_mock" });

export function installTwilioMock() {
  vi.mock("twilio", () => {
    const twilioFactory = vi.fn().mockReturnValue({
      messages: { create: mockMessagesCreate },
    });
    return { default: twilioFactory };
  });
}

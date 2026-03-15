import { vi } from "vitest";

export const mockCustomersCreate = vi.fn().mockResolvedValue({ id: "cus_mock" });
export const mockCheckoutSessionsCreate = vi.fn().mockResolvedValue({ id: "cs_mock", url: "https://checkout.stripe.com/mock" });

export function installStripeMock() {
  vi.mock("stripe", () => {
    const MockStripe = vi.fn().mockImplementation(() => ({
      customers: { create: mockCustomersCreate },
      checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    }));
    return { default: MockStripe };
  });
}

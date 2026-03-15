import { describe, it, expect, beforeEach, vi } from "vitest";

// Stripe module uses module-level singletons, so we need vi.resetModules() and dynamic import
describe("getStripeMode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 'demo' when STRIPE_MODE is 'demo'", async () => {
    process.env.STRIPE_MODE = "demo";
    const { getStripeMode } = await import("@/lib/stripe");
    expect(getStripeMode()).toBe("demo");
  });

  it("returns 'monetize' when STRIPE_MODE is 'monetize'", async () => {
    process.env.STRIPE_MODE = "monetize";
    const { getStripeMode } = await import("@/lib/stripe");
    expect(getStripeMode()).toBe("monetize");
  });

  it("throws when STRIPE_MODE is unset", async () => {
    delete process.env.STRIPE_MODE;
    const { getStripeMode } = await import("@/lib/stripe");
    expect(() => getStripeMode()).toThrow("STRIPE_MODE must be");
  });

  it("throws when STRIPE_MODE is invalid", async () => {
    process.env.STRIPE_MODE = "invalid";
    const { getStripeMode } = await import("@/lib/stripe");
    expect(() => getStripeMode()).toThrow("STRIPE_MODE must be");
  });
});

describe("getStripe", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("creates Stripe client in demo mode with test key", async () => {
    process.env.STRIPE_MODE = "demo";
    process.env.STRIPE_TEST_SECRET_KEY = "sk_test_key123";
    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe();
    expect(stripe).toBeDefined();
  });

  it("throws when demo mode has no test key", async () => {
    process.env.STRIPE_MODE = "demo";
    delete process.env.STRIPE_TEST_SECRET_KEY;
    const { getStripe } = await import("@/lib/stripe");
    expect(() => getStripe()).toThrow("Missing STRIPE_TEST_SECRET_KEY");
  });

  it("throws when monetize mode has no live key", async () => {
    process.env.STRIPE_MODE = "monetize";
    delete process.env.STRIPE_LIVE_SECRET_KEY;
    const { getStripe } = await import("@/lib/stripe");
    expect(() => getStripe()).toThrow("Missing STRIPE_LIVE_SECRET_KEY");
  });

  it("caches the Stripe instance (singleton)", async () => {
    process.env.STRIPE_MODE = "demo";
    process.env.STRIPE_TEST_SECRET_KEY = "sk_test_cached";
    const { getStripe } = await import("@/lib/stripe");
    const first = getStripe();
    const second = getStripe();
    expect(first).toBe(second);
  });
});

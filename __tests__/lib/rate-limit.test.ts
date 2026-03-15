import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  rateLimit,
  clearStore,
  shouldBypass,
  rateLimitHeaders,
  RATE_LIMIT_CONFIGS,
  stopCleanupInterval,
  startCleanupInterval,
  type RateLimitConfig,
  type RateLimitResult,
} from "@/lib/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    clearStore();
  });

  describe("rateLimit()", () => {
    const config: RateLimitConfig = { limit: 3, windowMs: 1000 };

    it("allows requests within the limit", async () => {
      const result = await rateLimit("test-key", config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.resetAt).toBeGreaterThan(Date.now() - 100);
    });

    it("decrements remaining count correctly", async () => {
      const r1 = await rateLimit("test-key", config);
      expect(r1.remaining).toBe(2);

      const r2 = await rateLimit("test-key", config);
      expect(r2.remaining).toBe(1);

      const r3 = await rateLimit("test-key", config);
      expect(r3.remaining).toBe(0);
    });

    it("returns 429 equivalent (allowed=false) when limit exceeded", async () => {
      // Exhaust the limit
      await rateLimit("test-key", config);
      await rateLimit("test-key", config);
      await rateLimit("test-key", config);

      // Fourth request should be denied
      const result = await rateLimit("test-key", config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    it("refills tokens after window expires", async () => {
      const shortConfig: RateLimitConfig = { limit: 2, windowMs: 50 };

      await rateLimit("test-key", shortConfig);
      await rateLimit("test-key", shortConfig);

      // Should be denied
      const denied = await rateLimit("test-key", shortConfig);
      expect(denied.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Should be allowed again
      const refilled = await rateLimit("test-key", shortConfig);
      expect(refilled.allowed).toBe(true);
      expect(refilled.remaining).toBe(1);
    });

    it("keeps keys independent", async () => {
      await rateLimit("key-a", config);
      await rateLimit("key-a", config);
      await rateLimit("key-a", config);

      // key-a exhausted, but key-b should still work
      const resultA = await rateLimit("key-a", config);
      expect(resultA.allowed).toBe(false);

      const resultB = await rateLimit("key-b", config);
      expect(resultB.allowed).toBe(true);
      expect(resultB.remaining).toBe(2);
    });

    it("provides valid resetAt timestamp", async () => {
      const now = Date.now();
      const result = await rateLimit("test-key", config);
      // resetAt should be approximately now + windowMs
      expect(result.resetAt).toBeGreaterThanOrEqual(now);
      expect(result.resetAt).toBeLessThanOrEqual(now + config.windowMs + 100);
    });
  });

  describe("shouldBypass()", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("returns true when bypass header matches secret", () => {
      process.env.RATE_LIMIT_BYPASS_SECRET = "my-secret-123";
      const headers = new Headers({
        "x-rate-limit-bypass": "my-secret-123",
      });
      expect(shouldBypass(headers)).toBe(true);
    });

    it("returns false when bypass header does not match", () => {
      process.env.RATE_LIMIT_BYPASS_SECRET = "my-secret-123";
      const headers = new Headers({
        "x-rate-limit-bypass": "wrong-secret",
      });
      expect(shouldBypass(headers)).toBe(false);
    });

    it("returns false when no bypass secret is configured", () => {
      delete process.env.RATE_LIMIT_BYPASS_SECRET;
      const headers = new Headers({
        "x-rate-limit-bypass": "anything",
      });
      expect(shouldBypass(headers)).toBe(false);
    });

    it("returns true for service-role authorization", () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
      const headers = new Headers({
        authorization: "Bearer test-service-role-key",
      });
      expect(shouldBypass(headers)).toBe(true);
    });

    it("returns false for non-service-role authorization", () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
      const headers = new Headers({
        authorization: "Bearer some-other-key",
      });
      expect(shouldBypass(headers)).toBe(false);
    });

    it("returns false for empty headers", () => {
      const headers = new Headers();
      expect(shouldBypass(headers)).toBe(false);
    });
  });

  describe("rateLimitHeaders()", () => {
    it("returns correctly formatted headers", () => {
      const result: RateLimitResult = {
        allowed: true,
        remaining: 15,
        resetAt: 1700000000000,
      };
      const config: RateLimitConfig = { limit: 20, windowMs: 60_000 };

      const headers = rateLimitHeaders(result, config);

      expect(headers["X-RateLimit-Limit"]).toBe("20");
      expect(headers["X-RateLimit-Remaining"]).toBe("15");
      expect(headers["X-RateLimit-Reset"]).toBe("1700000000");
    });

    it("returns zero remaining when denied", () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetAt: 1700000060000,
      };
      const config: RateLimitConfig = { limit: 10, windowMs: 60_000 };

      const headers = rateLimitHeaders(result, config);

      expect(headers["X-RateLimit-Limit"]).toBe("10");
      expect(headers["X-RateLimit-Remaining"]).toBe("0");
    });
  });

  describe("RATE_LIMIT_CONFIGS", () => {
    it("has correct chat config", () => {
      expect(RATE_LIMIT_CONFIGS.chat).toEqual({ limit: 20, windowMs: 60_000 });
    });

    it("has correct sms config", () => {
      expect(RATE_LIMIT_CONFIGS.sms).toEqual({ limit: 10, windowMs: 60_000 });
    });

    it("has correct listings config", () => {
      expect(RATE_LIMIT_CONFIGS.listings).toEqual({ limit: 60, windowMs: 60_000 });
    });

    it("has correct stripe config", () => {
      expect(RATE_LIMIT_CONFIGS.stripe).toEqual({ limit: 30, windowMs: 60_000 });
    });
  });

  describe("cleanup", () => {
    it("stopCleanupInterval and startCleanupInterval work without error", () => {
      expect(() => stopCleanupInterval()).not.toThrow();
      expect(() => startCleanupInterval()).not.toThrow();
    });
  });

  describe("clearStore()", () => {
    it("removes all entries", async () => {
      const config: RateLimitConfig = { limit: 5, windowMs: 60_000 };
      await rateLimit("key-1", config);
      await rateLimit("key-2", config);

      clearStore();

      // After clearing, should be fresh
      const result = await rateLimit("key-1", config);
      expect(result.remaining).toBe(4);
    });
  });
});

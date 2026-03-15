/**
 * In-memory sliding-window rate limiter.
 *
 * Limitation: State resets on cold start (serverless) since it uses a Map.
 * For production, consider a Supabase-backed or Redis-backed sliding window.
 *
 * Supabase fallback path:
 *   1. Create a `rate_limit_entries` table with columns: key, timestamp, window_ms
 *   2. On each request, INSERT the current timestamp
 *   3. COUNT entries WHERE key = $key AND timestamp > now() - window_ms
 *   4. DELETE expired entries periodically via pg_cron
 *   This provides persistence across cold starts at the cost of a DB round-trip.
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether this request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the window resets */
  resetAt: number;
}

interface SlidingWindowEntry {
  timestamps: number[];
}

/** Internal store -- exported only for testing purposes */
export const store = new Map<string, SlidingWindowEntry>();

/**
 * Clean up expired entries from the store.
 * Called periodically to prevent memory leaks.
 */
function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    // Remove entries that have no recent timestamps (oldest window we track is 60s)
    const maxWindow = 60_000;
    entry.timestamps = entry.timestamps.filter((t) => now - t < maxWindow);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

// Run cleanup every 60 seconds to prevent memory leaks
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startCleanupInterval(): void {
  if (cleanupInterval === null) {
    cleanupInterval = setInterval(cleanup, 60_000);
    // Allow the process to exit even if the interval is active
    if (typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
      cleanupInterval.unref();
    }
  }
}

export function stopCleanupInterval(): void {
  if (cleanupInterval !== null) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Start cleanup on module load
startCleanupInterval();

/**
 * Check rate limit for a given key.
 *
 * Uses a sliding window algorithm: maintains a list of timestamps for each key,
 * filters out timestamps outside the current window, and checks if the count
 * exceeds the limit.
 */
export async function rateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  const currentCount = entry.timestamps.length;

  if (currentCount >= config.limit) {
    // Find the earliest timestamp in the window to calculate reset time
    const earliest = entry.timestamps[0];
    const resetAt = earliest + config.windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  // Allow the request and record the timestamp
  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: config.limit - entry.timestamps.length,
    resetAt: now + config.windowMs,
  };
}

/**
 * Rate limit configurations for each endpoint.
 */
export const RATE_LIMIT_CONFIGS = {
  chat: { limit: 20, windowMs: 60_000 } satisfies RateLimitConfig,
  sms: { limit: 10, windowMs: 60_000 } satisfies RateLimitConfig,
  listings: { limit: 60, windowMs: 60_000 } satisfies RateLimitConfig,
  stripe: { limit: 30, windowMs: 60_000 } satisfies RateLimitConfig,
} as const;

/**
 * Environment variable name for bypass secret.
 * Internal callers can set this header to bypass rate limiting.
 */
export const BYPASS_HEADER = "x-rate-limit-bypass";
export const BYPASS_SECRET_ENV = "RATE_LIMIT_BYPASS_SECRET";

/**
 * Check if a request should bypass rate limiting.
 * Returns true if:
 *   - The request includes a valid bypass secret
 *   - The request is a service-role request (has service role key in authorization)
 */
export function shouldBypass(headers: Headers): boolean {
  // Check bypass secret
  const bypassSecret = process.env[BYPASS_SECRET_ENV];
  if (bypassSecret && headers.get(BYPASS_HEADER) === bypassSecret) {
    return true;
  }

  // Check service-role authorization
  const authHeader = headers.get("authorization");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    serviceRoleKey &&
    authHeader &&
    authHeader.includes(serviceRoleKey)
  ) {
    return true;
  }

  return false;
}

/**
 * Build standard rate limit response headers.
 */
export function rateLimitHeaders(
  result: RateLimitResult,
  config: RateLimitConfig,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(config.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

/**
 * Clear the rate limit store. Used in tests.
 */
export function clearStore(): void {
  store.clear();
}

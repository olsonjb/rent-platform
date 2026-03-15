# TASK T05: Rate Limiting

You are an autonomous agent working on the `rent-platform` repository. Your task is to add rate limiting to all public-facing endpoints to prevent abuse and uncontrolled Claude API costs.

## Context
Every chat message triggers a Claude API call (~$0.003–$0.01 per message on Sonnet). Without rate limiting, a single bad actor or runaway client could generate thousands of dollars in API costs. The SMS endpoint is especially vulnerable since phone numbers can be spoofed.

## Acceptance Criteria

### 1. Rate Limiter Implementation (`lib/rate-limit.ts`)
- Implement a token-bucket or sliding-window rate limiter
- Storage: Use Supabase table `rate_limits` with columns: key (text, PK), tokens (int), last_refill (timestamptz) — OR use in-memory Map with TTL (simpler, acceptable for single-instance Vercel deployment)
- Export `rateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult>`
- `RateLimitResult` includes: `allowed: boolean`, `remaining: number`, `resetAt: Date`
- Support configurable limits per endpoint type

### 2. Apply Rate Limits
| Endpoint | Key | Limit | Window |
|----------|-----|-------|--------|
| `/api/chat` | `chat:{userId}` | 20 messages | per minute |
| `/api/sms` | `sms:{phoneNumber}` | 10 messages | per minute |
| `/api/listings` (GET) | `listings:{ip}` | 60 requests | per minute |
| `/api/webhooks/stripe` | `stripe:{ip}` | 30 requests | per minute |

### 3. Response Headers
- Add `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers to rate-limited responses
- Return HTTP 429 with a clear error message when limit exceeded
- For SMS: return TwiML response saying "You're sending messages too quickly. Please try again in a minute."

### 4. Rate Limit Bypass
- Service-role requests (from internal cron/workers) bypass rate limiting
- Add `RATE_LIMIT_BYPASS_SECRET` env var for internal callers
- Stripe webhooks with valid signatures should have a higher limit, not be blocked

### 5. Tests (`__tests__/lib/rate-limit.test.ts`)
- Test that requests within limit are allowed
- Test that exceeding limit returns 429
- Test that tokens refill after window expires
- Test that different keys are independent
- Test bypass mechanism works

## Technical Constraints
- Must work on Vercel serverless (no persistent in-memory state across invocations unless you use Supabase or KV)
- If using in-memory, document the limitation (resets on cold start) and provide a path to Supabase-backed implementation
- Don't add heavy dependencies — no Redis, no external rate limit services
- Consider using Vercel KV or Supabase table for persistence

## Definition of Done
- All listed endpoints enforce rate limits
- HTTP 429 responses include proper headers
- Tests pass
- `npm run build` passes
- Existing functionality works within normal usage patterns

When ALL acceptance criteria are met and verified, output exactly: TASK_COMPLETE

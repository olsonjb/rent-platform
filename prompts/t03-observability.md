# TASK T03: Observability Stack

You are an autonomous agent working on the `rent-platform` repository. Your task is to add structured logging, error tracking, and cost monitoring across the application.

## Context
The app currently uses bare `console.error` and `console.log` with no structure, no correlation IDs, and no way to track Claude API costs. This is a multi-agent AI system where every API call costs money.

## Acceptance Criteria

### 1. Structured Logger (`lib/logger.ts`)
- Create a lightweight structured JSON logger (no heavy dependencies — use `pino` or a custom implementation)
- Every log entry must include: `timestamp`, `level`, `message`, `service` (e.g., "chat-api", "maintenance-review", "screening-agent"), `correlationId`
- Levels: debug, info, warn, error
- In development: pretty-print to console. In production: JSON to stdout.
- Export a `createLogger(service: string)` factory

### 2. Request Correlation
- Create middleware or utility that generates a `correlationId` (UUID) per inbound request
- Thread it through to all downstream calls (Claude API, Supabase, Twilio, Google Places)
- Log the correlationId on every API route entry and exit

### 3. Claude API Cost Tracking (`lib/ai-metrics.ts`)
- Create a wrapper around Anthropic SDK calls that:
  - Logs input_tokens, output_tokens, model, and latency_ms for every call
  - Computes estimated cost based on model pricing (Sonnet: $3/$15 per MTok input/output)
  - Stores metrics in a Supabase table `ai_usage_log` with columns: id, correlation_id, service, model, input_tokens, output_tokens, estimated_cost_usd, latency_ms, created_at
- Create the Supabase migration for this table
- Wrap existing Claude calls in: `app/api/chat/route.ts`, `app/api/sms/route.ts`, `lib/maintenance-review.ts`, `lib/agent/screening-agent.ts`, `lib/agent/decision.ts`, `lib/agent/content.ts`

### 4. Error Boundaries
- Add Next.js `error.tsx` at app root and key route groups (`/landlord`, `/renter`, `/protected`)
- Add `global-error.tsx` for unhandled errors
- Each error boundary should log the error with the structured logger
- Display a user-friendly error message, not a stack trace

### 5. Health Check Endpoint (`app/api/health/route.ts`)
- Returns 200 with JSON: `{ status: "ok", timestamp, version (from package.json), uptime }`
- Checks Supabase connectivity (simple query)
- Returns 503 if Supabase is unreachable

### 6. Replace All console.log/console.error
- Find and replace every `console.log` and `console.error` in the codebase with the structured logger
- Ensure error objects are properly serialized (message + stack)

## Technical Constraints
- Keep dependencies minimal — prefer `pino` over winston/bunyan
- The AI usage log table must have RLS (service_role only)
- Don't break existing functionality — this is purely additive
- All new code must have TypeScript types, no `any`

## Definition of Done
- `npm run build` passes
- Every API route logs entry/exit with correlationId
- Every Claude API call logs token usage and estimated cost
- No bare `console.log` or `console.error` remains in `lib/` or `app/`
- Error boundaries render for simulated errors
- Health check endpoint returns 200

When ALL acceptance criteria are met and verified, output exactly: TASK_COMPLETE

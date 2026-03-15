# TASK T06: Architecture Hardening

You are an autonomous agent working on the `rent-platform` repository. Your task is to refactor duplicated code, add idempotency, and harden the overall architecture.

## Context
The codebase has several architecture issues identified in review: duplicated maintenance request parsing between chat and SMS routes, no idempotency on maintenance request creation (duplicate messages create duplicate requests), and the chat history loads unbounded messages.

## Acceptance Criteria

### 1. Extract Shared Chat Logic
- The `parseMaintenanceRequests()` function is duplicated in `app/api/chat/route.ts` and `app/api/sms/route.ts`
- Extract to `lib/chat/parse-maintenance.ts` (the fix/architecture-review-hardening branch has a start — use that pattern)
- Extract shared maintenance request creation + landlord notification logic to `lib/chat/handle-maintenance.ts`
- Both routes should import from these shared modules
- Reduce each route to: validate → load context → call Claude → parse response → handle maintenance → save → respond

### 2. Idempotency for Maintenance Requests
- Add an `idempotency_key` column to `maintenance_requests` table (unique, nullable)
- Generate idempotency key from: `hash(tenant_id + issue_text_normalized + date)`
- Before inserting a maintenance request, check if one with the same key exists in the last 24 hours
- If duplicate detected: skip insertion, log it, but still respond to tenant normally
- Create the Supabase migration for this

### 3. Chat History Windowing
- Current: loads up to 50 web / 30 SMS messages per Claude call
- Implement a sliding window: last 20 messages, plus a system-generated summary of older messages
- Create `lib/chat/history.ts` with `getConversationHistory(tenantId, channel, limit)` that:
  - Fetches the last `limit` messages
  - If more history exists, prepend a one-paragraph summary (generated on-demand or cached)
  - For MVP: just truncate to last 20. Add a TODO for summary generation.
- This reduces token usage per Claude call significantly

### 4. Server Action Input Validation
- Audit all server actions in `app/actions/*.ts`
- Add proper input validation using Zod or manual checks for:
  - `createProperty`: validate all required fields, rent > 0, bedrooms > 0
  - `createLease`: validate dates, monthly_rent > 0, end > start
  - `createTenant`: validate email format, name non-empty
  - `submitApplication`: already has validation — verify it's comprehensive
- Return user-friendly error messages, not raw Supabase errors

### 5. Consistent Error Response Format
- Create `lib/api-response.ts` with helpers:
  - `apiSuccess(data, status = 200)`
  - `apiError(message, status, details?)`
- All API routes should use these instead of raw `NextResponse.json`
- Error responses always include: `{ error: string, code?: string, details?: unknown }`

### 6. Tests
- Test `parseMaintenanceRequests()` with: no requests, single request, multiple requests, malformed JSON blocks, missing delimiters
- Test idempotency key generation and duplicate detection
- Test input validation for server actions (valid and invalid inputs)
- Test API response helpers

## Technical Constraints
- Don't change external behavior — responses to tenants and landlords must remain the same
- The maintenance request parsing delimiter format (`|||MAINTENANCE_REQUEST|||`) must not change (the Claude system prompt depends on it)
- Migrations must be additive (don't drop/recreate tables)

## Definition of Done
- Zero duplicated business logic between chat and SMS routes
- Duplicate maintenance requests within 24 hours are silently deduplicated
- All server actions validate inputs before database operations
- All API routes use consistent error format
- Tests pass, build passes, no TypeScript errors

When ALL acceptance criteria are met and verified, output exactly: TASK_COMPLETE

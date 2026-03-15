# TASK T02: Test Infrastructure & Core Test Suite

You are an autonomous agent working on the `rent-platform` repository. Your task is to establish the test infrastructure and write foundational tests for all critical business logic.

## Context
This project has ZERO tests. You are building the testing foundation. The codebase uses Next.js 15 App Router, Supabase, Anthropic SDK, Twilio, and Stripe. Business-critical code lives in `lib/` (agents, screening, maintenance reviews, payments) and `app/actions/` (server actions).

## Acceptance Criteria

### 1. Test Framework Setup
- Install and configure Vitest with TypeScript support
- Configure path aliases (`@/lib/*`, `@/components/*`, etc.) to match `tsconfig.json`
- Add `vitest.config.ts` with proper Next.js and TypeScript transforms
- Add `test` and `test:coverage` scripts to `package.json`
- Configure coverage reporter (v8 or istanbul) with threshold enforcement: 80% on `lib/`

### 2. Mock Infrastructure (`__tests__/mocks/`)
- Create reusable mocks for:
  - `@anthropic-ai/sdk` — mock `messages.create` returning configurable responses
  - `@supabase/supabase-js` — mock client with chainable `.from().select().eq()` etc.
  - `twilio` — mock `messages.create`
  - `stripe` — mock key methods (customers.create, checkout.sessions.create, webhooks.constructEvent)
  - `node-fetch` / global fetch — for Google Places API calls
- Each mock should be independently importable and configurable per test

### 3. Agent Tests (`__tests__/lib/agent/`)
- **screening-agent.test.ts**: Test `screenApplication()` with:
  - Approval case (good income, good credit, no evictions)
  - Denial case (income below 2.5x, evictions)
  - Edge case: self-employed needing 3.5x income
  - Edge case: malformed Claude response (fallback to FALLBACK_DECISION)
  - Verify income_ratio is computed correctly, not from Claude response
  - Verify confidence and risk_score are clamped to valid ranges

- **decision.test.ts**: Test `makeListingDecision()` with:
  - Lease expiring in 7 days (should list, high urgency)
  - Lease expiring in 25 days (should list, low urgency)
  - Renewal already offered (should not list)
  - Malformed Claude JSON response (graceful fallback)

- **content.test.ts**: Test `generateListingContent()` with:
  - Valid generation case
  - Malformed JSON fallback
  - Verify fallback title uses address

- **submit.test.ts**: Test `submitToProviders()` with:
  - All providers succeed
  - One provider fails, others succeed
  - All providers fail

### 4. Maintenance Review Tests (`__tests__/lib/`)
- **maintenance-review.test.ts**: Test `processQueuedMaintenanceReviews()` with:
  - Happy path: claim job → estimate cost → find vendors → save → complete
  - Retry logic: first attempt fails, second succeeds
  - Max retries exceeded → job marked failed
  - Empty queue → no errors, returns {claimed: 0}
  - Verify cost sanitization (negative costs clamped to 0, min ≤ max)
  - Verify confidence normalization (clamped 0–1)

### 5. Application Screening Tests (`__tests__/lib/`)
- **application-screening.test.ts**: Test `processQueuedApplicationScreenings()` with:
  - Happy path: claim → screen → save result → complete
  - Status transitions: pending → screening → approved/denied
  - Retry and failure paths
  - Empty queue handling

### 6. Stripe Tests (`__tests__/lib/`)
- **stripe.test.ts**: Test `getStripe()` and `getStripeMode()` with:
  - Demo mode returns test key
  - Monetize mode returns live key
  - Missing key throws descriptive error
  - Invalid STRIPE_MODE throws

### 7. Utility Tests
- **maintenance-requests.test.ts**: Test all type guards (isMaintenanceRequestLocation, isMaintenanceRequestUrgency, etc.)
- **twilio/sms.test.ts**: Test `toE164()`, `normalizeFromForLookup()`, `buildLandlordSms()` with various input formats

## Technical Constraints
- Never call real APIs in tests — everything is mocked
- Tests must run in < 30 seconds total
- Tests must pass with `npm test` from a fresh clone (no local state)
- Use `describe`/`it` blocks with descriptive names
- Each test file must be independently runnable

## Definition of Done
- `npm test` passes with 0 failures
- `npm run test:coverage` shows ≥ 80% on all files in `lib/`
- All agent edge cases (malformed AI responses, retry logic, fallback behavior) are tested
- Mocks are reusable and documented

When ALL acceptance criteria are met and verified by running `npm test` successfully, output exactly: TASK_COMPLETE

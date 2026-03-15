# TASK T04: Twilio Webhook Signature Validation

You are an autonomous agent working on the `rent-platform` repository. Your task is to secure the SMS webhook endpoint against spoofing attacks.

## Context
The `/api/sms` endpoint currently accepts ANY POST request. Anyone who discovers the URL can impersonate tenants, inject fake maintenance requests, and potentially trigger Claude API calls at our expense. This is a critical security vulnerability.

## Acceptance Criteria

### 1. Signature Validation Middleware (`lib/twilio/validate.ts`)
- Implement Twilio request signature validation using the `twilio` package's `validateRequest` or `webhook()` helper
- Validate the `X-Twilio-Signature` header against the request body and your auth token
- Use `TWILIO_AUTH_TOKEN` from environment
- Support both production (validate) and development (configurable bypass with `TWILIO_SKIP_VALIDATION=true`)
- Return 403 with a generic error message on invalid signatures (don't leak details)
- Log failed validation attempts with the structured logger (if T03 is done) or console.warn

### 2. Apply to SMS Route (`app/api/sms/route.ts`)
- Validate signature BEFORE any business logic, Supabase queries, or Claude API calls
- If validation fails, return TwiML error response (not JSON) since Twilio expects XML
- Include the request URL construction (must match what Twilio signed against, including protocol and host)

### 3. Internal Endpoint Protection
- Protect `app/api/internal/maintenance-reviews/process/route.ts` with a shared secret header (`X-Internal-Secret` matching `INTERNAL_API_SECRET` env var)
- Protect `app/api/internal/application-screenings/process/route.ts` the same way
- Return 401 on missing/invalid secret

### 4. Tests (`__tests__/lib/twilio/validate.test.ts`)
- Test valid signature passes
- Test invalid signature returns 403
- Test missing signature header returns 403
- Test development bypass mode works when `TWILIO_SKIP_VALIDATION=true`
- Test internal endpoint rejects requests without secret
- Test internal endpoint accepts requests with correct secret

### 5. Environment Documentation
- Update `.env.example` (create if missing) with:
  - `TWILIO_SKIP_VALIDATION=true` (for local dev)
  - `INTERNAL_API_SECRET=your-secret-here`
- Add a `SECURITY.md` documenting the webhook validation approach

## Technical Constraints
- Twilio signs against the FULL request URL including protocol — in production behind a proxy, you may need `TWILIO_WEBHOOK_URL` env var to specify the canonical URL
- The validation must happen before `request.formData()` is fully consumed if Twilio's SDK needs the raw body
- Do NOT break the existing SMS chat functionality — tenant messages must still flow through

## Definition of Done
- Invalid/missing Twilio signatures return 403 TwiML
- Internal endpoints reject unauthenticated requests
- All tests pass
- Existing SMS flow still works (test with valid mock signature)
- `npm run build` passes

When ALL acceptance criteria are met and verified, output exactly: TASK_COMPLETE

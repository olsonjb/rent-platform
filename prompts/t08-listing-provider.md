# TASK T08: Real Listing Provider Integration

You are an autonomous agent working on the `rent-platform` repository. Your task is to replace at least one mock listing provider with a real, functional integration.

## Context
All four listing providers (Zillow, Apartments.com, Craigslist, Rentler) are mock stubs that return random success/failure. The auto-listing agent architecture is solid but writes to nowhere. We need at least ONE real provider for the feature to deliver value.

## Acceptance Criteria

### 1. Craigslist Posting via Email Gateway
- Craigslist accepts listings via email in many markets. Implement a provider that:
  - Composes a properly formatted listing email (title, body, category, location)
  - Sends via a configurable SMTP/email service (Resend, SendGrid, or Nodemailer with SMTP)
  - Returns success based on email delivery (not posting confirmation — Craigslist doesn't provide that)
- This is the most achievable "real" integration without API partnerships
- Configure via: `CRAIGSLIST_POSTING_EMAIL`, `CRAIGSLIST_REPLY_EMAIL`, `EMAIL_SMTP_*` env vars

### 2. Zillow/Apartments.com API Research (`docs/listing-providers-research.md`)
- Document the actual API requirements for Zillow Rental Manager and Apartments.com
- Note: if they require MLS membership, partnership agreements, or OAuth, document the process
- Provide a realistic implementation plan with timelines
- This is documentation, not code — but it must be thorough and accurate

### 3. Generic Webhook Provider (`lib/providers/webhook.ts`)
- Create a generic webhook provider that POSTs listing data to a configurable URL
- This allows landlords to connect ANY service via Zapier, Make, or custom webhooks
- Config: `WEBHOOK_LISTING_URL`, `WEBHOOK_LISTING_SECRET` (HMAC signature)
- Include HMAC-SHA256 signature in `X-Webhook-Signature` header
- Retry once on failure with exponential backoff

### 4. Provider Configuration System
- Replace the hardcoded `activeProviders` array in `lib/providers/index.ts`
- Load active providers from environment or database configuration
- Support enabling/disabling providers per landlord (future: store in properties or profiles table)
- For now: read `ACTIVE_LISTING_PROVIDERS=craigslist,webhook` from env

### 5. Provider Health Dashboard Data
- Add a `listing_provider_log` Supabase table: id, listing_id, provider, status (success/failed/pending), response_data (jsonb), created_at
- Log every provider submission attempt
- Create migration

### 6. Tests
- Test Craigslist email composition (mock the email send)
- Test webhook provider with HMAC signature verification
- Test provider configuration loading from env
- Test provider logging

## Technical Constraints
- Do NOT require paid API keys for the initial implementation — use email/webhook approaches
- The Craigslist email approach is market-dependent — document which markets support it
- Keep the mock providers available for development (activated via env config)

## Definition of Done
- At least one provider sends a real listing to an external service (email or webhook)
- Provider configuration is environment-driven, not hardcoded
- All submissions are logged to the database
- Tests pass, build passes

When ALL acceptance criteria are met and verified, output exactly: TASK_COMPLETE

# TASK T13: Vendor Dispatch Agent

You are an autonomous agent working on the `rent-platform` repository. Your task is to build an AI agent that automatically contacts maintenance vendors, gets quotes, and presents options to the landlord for one-click approval.

## Acceptance Criteria

### 1. Vendor Contact Agent (`lib/agent/vendor-dispatch.ts`)
- After a maintenance review is completed (cost estimate + vendor list), trigger this agent
- The agent:
  - Takes the top 3 vendors from the review
  - Composes a professional outreach message per vendor (via SMS or email) describing the issue, location, and requesting a quote
  - Tracks which vendors were contacted
  - Stores outreach attempts in a `vendor_outreach` table

### 2. Vendor Outreach Table (migration)
- `vendor_outreach`: id, maintenance_request_id, vendor_name, vendor_phone, vendor_email, outreach_method (sms/email), message_sent, status (sent/responded/no_response/declined), quote_amount_cents, quote_details, sent_at, responded_at, created_at
- RLS: landlord can view for their properties

### 3. Quote Collection Webhook (`app/api/vendor-reply/route.ts`)
- When a vendor replies via SMS (Twilio), route vendor responses to this endpoint
- Use Claude to parse the vendor reply and extract: quote amount, availability, notes
- Update the `vendor_outreach` record with the parsed quote
- Notify the landlord when quotes arrive

### 4. Landlord Approval Flow
- On the landlord maintenance detail page, show:
  - Vendor outreach status (contacted, awaiting reply, quote received)
  - Received quotes with vendor name, amount, rating, availability
  - "Approve" button next to each quote
  - "Request More Quotes" button to contact additional vendors
- When landlord approves a quote, update maintenance request status and send confirmation to vendor

### 5. Dispatch Trigger
- Create a database trigger or job that fires when a maintenance_request_review is saved
- Auto-enqueues vendor dispatch job (same pattern as existing job queues)
- `vendor_dispatch_jobs` table with claim/retry pattern

### 6. Tests
- Test outreach message generation for various trade types
- Test vendor reply parsing (quoted amounts, availability extraction)
- Test approval flow state transitions
- Test job queue claim/retry logic

## Technical Constraints
- Vendor SMS uses the same Twilio number — route vendor replies by detecting they're not from a known tenant phone
- Keep outreach messages professional and concise (SMS has 160 char limit per segment)
- Landlord must approve before any work is authorized — never auto-approve

## Definition of Done
- Vendors are automatically contacted after maintenance review
- Vendor replies are parsed and quotes displayed to landlord
- Landlord can approve a quote with one click
- Job queue follows existing retry patterns
- Tests pass, build passes

When ALL acceptance criteria are met and verified, output exactly: TASK_COMPLETE

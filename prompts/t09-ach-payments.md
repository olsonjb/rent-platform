# TASK T09: Rent Collection via ACH / Stripe

You are an autonomous agent working on the `rent-platform` repository. Your task is to build the rent collection pipeline — the core revenue engine of the platform (3% fee on collected rent).

## Context
The existing Stripe integration supports card authorization (setup mode) and a 30-day trial. But the actual rent COLLECTION infrastructure doesn't exist. Landlords can't collect rent through the platform, which means the 3% fee generates zero revenue.

## Acceptance Criteria

### 1. Tenant Payment Method Setup
- After a renter is linked to a property, they should be prompted to add a payment method
- Use Stripe Checkout in setup mode (like the existing landlord flow) to collect bank account or card
- Store `stripe_customer_id` and `stripe_payment_method_id` on the tenant/renter profile
- Support both card and ACH (US bank account via Stripe)

### 2. Rent Invoice Generation (`lib/billing/invoices.ts`)
- Create a `rent_invoices` Supabase table: id, lease_id, tenant_id, landlord_id, amount_cents, platform_fee_cents, status (pending/processing/succeeded/failed/overdue), due_date, stripe_payment_intent_id, created_at, paid_at
- Create a function `generateMonthlyInvoices()` that:
  - Finds all active leases
  - Creates an invoice for each (if one doesn't already exist for the current period)
  - Calculates platform fee (3% of rent)
  - Idempotent: safe to run multiple times per month
- Create the Supabase migration

### 3. Payment Processing (`lib/billing/process-payments.ts`)
- Create a function `processScheduledPayments()` that:
  - Finds invoices with status `pending` and `due_date <= today`
  - Creates a Stripe PaymentIntent for each using the tenant's saved payment method
  - Charges rent amount to tenant's payment method
  - Transfers (net of platform fee) to landlord's connected Stripe account (or holds for manual payout)
  - Updates invoice status based on result
- Handle failures gracefully: mark as `failed`, log error, don't retry automatically (tenant may need to update payment method)

### 4. Cron Endpoint (`app/api/cron/process-rent/route.ts`)
- Secured with CRON_SECRET bearer token (same pattern as check-leases)
- Calls `generateMonthlyInvoices()` then `processScheduledPayments()`
- Returns summary: invoices created, payments processed, failures

### 5. Payment Status Dashboard
- Add to landlord dashboard: list of recent invoices with status
- Add to renter dashboard: payment history, upcoming due date, payment method on file
- Show platform fee breakdown for landlord (rent collected - 3% fee = net)

### 6. Payment Reminders Integration Point
- Create `lib/billing/reminders.ts` with `getUpcomingPayments(daysAhead: number)` 
- Returns tenants with payments due within N days
- This will be called by a future SMS reminder system — just build the data layer now

### 7. Tests
- Test invoice generation idempotency (running twice doesn't create duplicates)
- Test fee calculation (3% of various rent amounts, rounding)
- Test payment processing with mock Stripe (success and failure paths)
- Test cron endpoint auth

## Technical Constraints
- Use Stripe test mode for all development — never touch live keys
- ACH payments take 3-5 business days to settle — handle the async nature
- Platform fee collection requires Stripe Connect (for transferring to landlord accounts) OR a simpler model where the platform collects and manually disburses. Start with the simpler model.
- All amounts in cents internally, display in dollars to users

## Definition of Done
- Monthly invoices are generated for all active leases
- Payments can be processed via Stripe (test mode)
- Landlord sees payment status, renter sees payment history
- 3% platform fee is calculated and tracked
- Tests pass, build passes

When ALL acceptance criteria are met and verified, output exactly: TASK_COMPLETE

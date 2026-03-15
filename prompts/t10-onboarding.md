# TASK T10: Landlord Onboarding Wizard

You are an autonomous agent working on the `rent-platform` repository. Your task is to build a guided onboarding flow that takes a new landlord from sign-up to fully operational in one session.

## Context
Currently, after sign-up, landlords land on a bare dashboard and must manually discover how to add properties, tenants, leases, and set up payments across multiple disconnected pages. Drop-off is guaranteed.

## Acceptance Criteria

### 1. Onboarding State Machine (`lib/onboarding/state.ts`)
- Define onboarding steps: `profile → add_property → add_tenant → create_lease → setup_payment → complete`
- Store current step in `profiles.onboarding_step` (add column via migration)
- Each step has: `isComplete(userId): Promise<boolean>` check
- Skip steps that are already satisfied (e.g., if property exists, skip add_property)

### 2. Onboarding Page (`app/protected/onboarding/page.tsx`)
- Redesign as a step-by-step wizard with:
  - Progress indicator showing all steps
  - Current step form/content
  - "Skip for now" option on non-critical steps (not on payment if in monetize mode)
  - "Back" navigation to previous steps
- Step 1 (Profile): Name, phone, timezone
- Step 2 (Property): Inline property creation form (reuse existing fields)
- Step 3 (Tenant): Add first tenant contact
- Step 4 (Lease): Create lease linking property and tenant
- Step 5 (Payment): Stripe setup or demo trial activation (reuse existing flow)
- Step 6 (Complete): Dashboard preview with "You're all set!" confirmation

### 3. Smart Redirects
- After sign-up, redirect to `/protected/onboarding` if onboarding is incomplete
- After completing onboarding, redirect to `/landlord/dashboard`
- If landlord navigates away mid-onboarding, resume where they left off on next visit
- The middleware should check onboarding status for landlord routes

### 4. Renter Onboarding (Lightweight)
- After renter sign-up: check if they're linked to a property
- If not linked: show a "Waiting for your landlord to add you" message with their email displayed
- If linked: redirect to `/renter/dashboard`
- No wizard needed — renters are passive until landlord links them

### 5. Tests
- Test onboarding state machine: step completion checks, progression logic
- Test skip behavior and resume behavior
- Test redirect logic for incomplete vs complete onboarding

## Technical Constraints
- Reuse existing server actions (createProperty, createTenant, createLease) — don't duplicate
- The wizard must work on mobile (responsive)
- Each step should save progress immediately (not wait for final "submit all")
- Use existing shadcn/ui components for consistency

## Definition of Done
- New landlord goes from sign-up to operational dashboard in one guided flow
- Progress persists across sessions
- Renters see appropriate waiting state when not yet linked
- All tests pass, build passes

When ALL acceptance criteria are met and verified, output exactly: TASK_COMPLETE

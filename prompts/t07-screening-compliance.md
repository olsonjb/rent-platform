# TASK T07: Fair Housing Screening Compliance

You are an autonomous agent working on the `rent-platform` repository. Your task is to make the AI tenant screening pipeline legally defensible under the Fair Housing Act.

## Context
The screening agent (`lib/agent/screening-agent.ts`) makes approve/deny decisions on rental applications. Under the Fair Housing Act (42 U.S.C. § 3601-3619), automated screening must not discriminate based on race, color, religion, sex, national origin, familial status, or disability. The current implementation has no compliance guardrails.

## Acceptance Criteria

### 1. Immutable Audit Log (`lib/screening/audit-log.ts`)
- Create a `screening_audit_log` Supabase table:
  - id (uuid PK), application_id (FK), event_type (enum: 'submitted', 'screening_started', 'ai_decision', 'landlord_override', 'final_decision'), event_data (jsonb), actor_id (uuid nullable), created_at (timestamptz)
- This table is APPEND-ONLY: no UPDATE or DELETE policies, even for service_role (use a Postgres trigger to prevent updates)
- Log every state transition in the application lifecycle
- Create the Supabase migration

### 2. Mandatory Human Review
- Modify `application-screening.ts` so AI decisions are NEVER final
- New status flow: `pending → screening → ai_reviewed → landlord_approved / landlord_denied`
- The AI sets status to `ai_reviewed` (not `approved` or `denied`)
- Add `ai_recommendation` field (approved/denied) separate from `status`
- Landlord MUST take action before any decision is communicated to applicant
- Update the `saveScreeningResult` function and related types

### 3. Adverse Action Notice Generator (`lib/screening/adverse-action.ts`)
- When a landlord denies an application, generate an adverse action notice per FCRA requirements
- Include: reason for denial (mapped from AI flags to human-readable reasons), applicant's right to dispute, contact information
- Store as `adverse_action_notice` (text) on the rental_application record
- Create a utility that maps AI flags to legally appropriate denial reasons (e.g., "insufficient_income" → "Income does not meet minimum requirement of 3x monthly rent")

### 4. Prompt Guardrails
- Update the screening agent prompt to explicitly:
  - State that decisions must be based ONLY on financial qualification, rental history, and verifiable references
  - Prohibit consideration of: name-based ethnicity inference, neighborhood demographics, familial status
  - Remove social media analysis from screening criteria (this is a legal landmine — social media can reveal protected characteristics)
  - Add instruction: "Do not infer or consider race, religion, national origin, sex, familial status, or disability from any input data"
- Remove `social_media_links` from the screening input (keep the field in DB for now, just don't send it to Claude)
- Update `social_media_notes` to always be null in the response

### 5. Disparate Impact Tracking (`lib/screening/disparate-impact.ts`)
- Create utility functions to:
  - Compute approval/denial rates by credit score range
  - Compute approval/denial rates by income bracket
  - Flag if any category shows >20% deviation from the overall rate
- These are reporting tools for the landlord, not automated enforcement
- Store computed metrics in a `screening_metrics` table (refreshed periodically)

### 6. Compliance Disclaimers
- Add a disclaimer banner to the landlord application review page:
  - "AI screening recommendations are advisory only. Final decisions must comply with the Fair Housing Act. You are responsible for ensuring non-discriminatory practices."
- Add to the applicant-facing status: "Your application is under review" (never show raw AI decision to applicants)

### 7. Tests
- Test audit log immutability (insert works, update/delete fails)
- Test status flow: verify AI cannot set final status
- Test adverse action notice generation with various flag combinations
- Test that social_media_links are NOT included in the Claude prompt
- Test disparate impact computation with sample data

## Technical Constraints
- This is a compliance-critical task. When in doubt, err on the side of MORE restrictions, not fewer.
- Do not delete existing data — add columns, don't remove them
- The applicant-facing UI should never show AI risk scores or internal flags

## Definition of Done
- AI decisions require landlord approval before taking effect
- Every screening event is logged in an immutable audit table
- Social media data is excluded from AI screening input
- Adverse action notices are generated on denial
- Disparate impact tracking utilities exist and are tested
- All tests pass, build passes

When ALL acceptance criteria are met and verified, output exactly: TASK_COMPLETE

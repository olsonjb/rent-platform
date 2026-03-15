# TASK T01: CI/CD Pipeline

You are an autonomous agent working on the `rent-platform` repository. Your task is to build a complete CI/CD pipeline using GitHub Actions.

## Context
This is a Next.js 15 App Router project with Supabase, TypeScript, Tailwind, Anthropic SDK, Twilio, and Stripe. There are currently ZERO automated checks. You are building the foundation that all other tasks depend on.

## Acceptance Criteria

### 1. PR Validation Workflow (`.github/workflows/ci.yml`)
- Triggers on: pull_request to main, push to main
- Jobs (run in parallel where possible):
  - **lint**: Run `npm run lint` with ESLint
  - **typecheck**: Run `npx tsc --noEmit`
  - **test**: Run test suite (vitest — install and configure if not present)
  - **build**: Run `npm run build` (with mock env vars so it doesn't crash on missing secrets)
- Use Node 20, cache node_modules via `actions/cache`
- Create a `.env.ci` or mock environment setup so the build doesn't fail on missing ANTHROPIC_API_KEY, TWILIO_*, STRIPE_*, etc. Use dummy placeholder values.

### 2. Supabase Migration Validation
- Add a job or step that validates SQL migrations parse correctly
- Use `supabase db lint` or a SQL syntax checker
- Ensure migration filenames follow timestamp ordering

### 3. Branch Protection Recommendations
- Create a `.github/BRANCH_PROTECTION.md` documenting recommended settings:
  - Require PR reviews
  - Require status checks (lint, typecheck, test, build) to pass
  - No direct pushes to main

### 4. Dependency Audit
- Add `npm audit --audit-level=moderate` as a non-blocking step (allow-failure)
- Report results but don't block merges on audit warnings

## Technical Constraints
- Do NOT add secrets to the workflow — use dummy env vars for build validation
- The Stripe lazy-init pattern means build will succeed with dummy `STRIPE_MODE=demo` and `STRIPE_TEST_SECRET_KEY=sk_test_dummy`
- Mock all required env vars in the workflow so `npm run build` passes
- Ensure the workflow file itself is valid YAML

## Definition of Done
- All 4 workflow jobs pass on a clean checkout of main
- Running `act` locally (if available) or pushing to a branch triggers the workflow
- No TypeScript errors, no lint errors
- The build completes successfully with mocked env vars

When ALL acceptance criteria are met and verified, output exactly: TASK_COMPLETE

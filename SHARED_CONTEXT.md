# Shared Context — Last updated: 2026-03-15

## Recently Merged
(none yet)

## Active Worktrees
(none yet)

## Key Decisions
- Test framework: TBD (T02 will decide)
- Logging library: TBD (T03 will decide)
- Rate limiter storage: TBD (T05 will decide)

## File Ownership Warnings
These files are frequently modified — agents touching them should coordinate:
- `app/api/chat/route.ts` — T03, T04, T05, T06 all touch this
- `app/api/sms/route.ts` — T03, T04, T05, T06 all touch this
- `lib/supabase/service.ts` — shared infrastructure
- `package.json` — every task that adds dependencies

## Architecture Notes
- All Supabase clients are created per-request via `createClient()` or `createServiceClient()`
- Claude API calls use `@anthropic-ai/sdk` directly — no wrapper yet (T12 will add one)
- Stripe uses lazy init with dual demo/monetize mode via `getStripe()`
- Maintenance request parsing uses `|||MAINTENANCE_REQUEST|||` delimiters — do not change this format

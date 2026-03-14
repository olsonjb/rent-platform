# Auto PM

Auto PM is an autonomous property management platform.

It primarily handles:
- Tenant communications
- Maintenance requests

## Next.js App Router Guardrails

- Prevent blocking-route errors by wrapping any page or layout that reads uncached server data in `<Suspense>`.
- If a route-level component awaits uncached data (for example Supabase auth/session reads, `searchParams`, `params`, or server actions feeding initial render), move that logic into an async child component and render it inside a Suspense boundary with a lightweight fallback.
- Keep route entry files (`page.tsx`, `layout.tsx`) as thin wrappers when possible: shell + `<Suspense>` + async content component.
- Validate new protected pages for this before merging, especially under `/protected/*`, `/renter/*`, and `/landlord/*`.

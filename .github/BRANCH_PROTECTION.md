# Branch Protection — `main`

Recommended branch protection rules for the `main` branch.

## Required Settings

| Setting | Value |
|---------|-------|
| Require pull request before merging | Yes |
| Required approving reviews | 1 |
| Dismiss stale PR approvals on new pushes | Yes |
| Require status checks to pass | Yes |
| Require branches to be up to date | Yes |

## Required Status Checks

These CI jobs must pass before a PR can be merged:

- **lint** — ESLint passes with no errors
- **typecheck** — TypeScript compilation with `--noEmit` passes
- **build** — `next build` succeeds
- **validate-migrations** — All SQL migration files are non-empty valid text

## Non-Required Status Checks

These run but do not block merging:

- **audit** — `npm audit --audit-level=high` (continue-on-error, advisory only)

## Future Additions

- **test** — Will be added as a required check after T02 (test suite) is complete

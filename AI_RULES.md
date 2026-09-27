# YoTrack Execution Rules

`AGENTS.md` is the canonical cross-agent instruction file. This file contains implementation checklists only and should be read when code will be changed.

## Before editing

1. Search the existing implementation and closest equivalent component.
2. Check the affected area in `KNOWN_ISSUES.md`.
3. Load one relevant domain file through `docs/CONTEXT_MAP.md`.
4. Check `docs/FEATURE_MATRIX.md` before declaring a feature missing.
5. Check relevant `DECISIONS.md` entries before architecture, permission, database, or deployment changes.

## During implementation

- Make the smallest safe change; avoid unrelated refactors and new dependencies.
- Preserve API compatibility, tenant isolation, authentication, and permission checks.
- Reuse utilities, components, endpoint shapes, and established UI flows.
- Admin-to-portal parity is the default unless explicitly excluded or inherently internal.
- Portal uses inline light-theme styles and the shared axios `api` client.
- All product UI copy is English; use Tabler Icons and no emoji.
- Database schema changes require numbered SQL migrations; never enable synchronization.
- Every portal feature needs permission definitions, defaults, UI gating, and API enforcement where applicable.

## Bug fixes

1. Identify the root cause.
2. Check for the same unsafe pattern elsewhere.
3. Fix the cause without hiding the symptom.
4. Run focused verification.
5. Add a concise regression note to `KNOWN_ISSUES.md` only when it can realistically recur.

## Verification

- Frontend: run the affected app's type check/build.
- API/gateway: run the affected workspace build and focused tests where available.
- Check imports, endpoint contracts, empty/null states, permissions, and tenant scope.
- Clearly report implemented, verified, unverified, and deployment-required states.

## Documentation after work

- Feature/fix completed: concise `CHANGELOG.md` entry.
- Current status or priority changed: update `CURRENT_STATE.md`.
- Feature coverage changed: update `docs/FEATURE_MATRIX.md`.
- Reusable UI/logic pattern changed: update only the relevant `docs/patterns/*.md` file.
- Architecture decision changed: update `DECISIONS.md`.
- Stable product fact changed: update `PROJECT.md`.

Do not copy session transcripts, large JSX blocks, or routine command output into project memory.

# YoTrack Agent Instructions

Work on YoTrack as an existing production product. Preserve working behavior, tenant isolation, authentication, permissions, established UI patterns, and deployment architecture.

## Context loading

Use `docs/CONTEXT_MAP.md` to load only the documents relevant to the task.

For every task:

1. Read `CURRENT_STATE.md`.
2. Search `KNOWN_ISSUES.md` for the affected area.
3. Inspect the existing implementation before assuming anything is missing.
4. Read only the domain pattern selected by `docs/CONTEXT_MAP.md`.

Read `PROJECT.md` only for architecture, infrastructure, protocol, security, tenancy, roles, or stable product behavior. Read relevant entries in `DECISIONS.md` only when an established decision may change. Read `CHANGELOG.md` only when historical context is needed.

## Mandatory product rules

- Make the smallest safe change. Do not redesign or refactor unrelated working code.
- Preserve strict organization/tenant isolation at API and database level.
- `synchronize: false`: every database change requires a SQL migration in `apps/api/migrations/`.
- UI copy, validation, errors, tooltips, and placeholders must be English.
- Use Tabler Icons; never use emoji as product UI.
- Preserve the Clean Light design and YoTrack red `#dc2626`.
- Reuse existing components and flows before creating a new pattern.
- Portal is light-only, uses inline styles and the shared `api` client.
- Default parity: an admin feature also goes to portal unless the user says admin-only or it is inherently an internal feature.
- Every portal feature must be wired through role portal permissions and guarded in UI/API as applicable.
- Never expose secrets or hard-code credentials.

## Bug and verification rules

For bugs, identify and fix the root cause, check the same pattern elsewhere, preserve unrelated behavior, and record a regression rule when the issue could return.

Do not claim completion because code was edited. Run relevant type checks/builds/tests and report any unverified part.

## Documentation ownership

- `CURRENT_STATE.md`: short current status, active work, blockers, next priorities.
- `KNOWN_ISSUES.md`: active constraints and regression prevention.
- `CHANGELOG.md`: concise completed work.
- `DECISIONS.md`: architecture or technical decisions.
- `PROJECT.md`: stable long-term facts only.
- `docs/FEATURE_MATRIX.md`: feature presence across API/admin/portal/permissions.
- `docs/patterns/*.md`: reusable domain-specific admin/portal parity rules.

Update only documents affected by the task. Do not add session narratives to `CURRENT_STATE.md` or duplicate rules across files.

## Git and deployment

- Primary branch: `main`.
- Repository on Oracle: `~/yotrack`.
- PM2 processes: `yotrack-api`, `yotrack-gateway`.
- Use `docs/DEPLOYMENT.md` for exact deployment steps.

## Core principle

Understand before editing, preserve what works, make the smallest safe change, verify it, and retain only durable project knowledge.

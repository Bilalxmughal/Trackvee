# YoTrack — Claude Master Instructions

You are working on the existing **YoTrack Vehicle Tracking Platform**.

Your job is to continue developing the existing product safely and consistently. Do not treat each task as a new project.

## Project Memory

- `PROJECT.md` — stable architecture, stack, design system, roles, infrastructure, and permanent context.
- `AI_RULES.md` — mandatory development and UI/UX rules.
- `CURRENT_STATE.md` — current status, active phase, blockers, and next steps.
- `KNOWN_ISSUES.md` — active issues, warnings, previous bug knowledge, and regression risks.
- `DECISIONS.md` — important architectural and technical decisions.
- `CHANGELOG.md` — concise history of meaningful implemented changes.

These files are the source of truth for project context.

## Before Starting Any Task

Always read `AI_RULES.md`, `CURRENT_STATE.md`, and `KNOWN_ISSUES.md`.

Read `PROJECT.md` when architecture, design system, roles, infrastructure, device protocol, security, or overall product behavior is relevant.

Read only relevant entries from `DECISIONS.md` and `CHANGELOG.md`. Do not load complete project history unnecessarily.

Inspect/search existing code before making changes. Never assume a feature is missing until the existing implementation has been checked.

## Preserve Existing Product

Do not unnecessarily change the existing UI theme, design language, colors, typography, spacing, layouts, sidebar/navigation, page structure, user flows, component patterns, API behavior, database architecture, authentication/authorization, or tenant isolation.

A feature request or bug fix is not permission to redesign or refactor unrelated parts of the application. Make the smallest safe change necessary.

## UI / UX Rules

Preserve the existing YoTrack design system.

- No emojis in product UI.
- Use the existing icon system / Tabler Icons.
- Do not introduce random icons or decorative symbols.
- Avoid generic AI-generated dashboard styling.
- Avoid unnecessary gradients, glassmorphism, excessive rounded cards, unnecessary shadows, oversized headings, and excessive empty space.
- Avoid decorative elements without a functional purpose.
- Avoid generic AI-style copy such as “Welcome back!” and similar filler.
- Keep wording concise, professional, and product-focused.
- Maintain the existing Clean Light design direction.
- Preserve the existing YoTrack red primary color and established status styling.
- Follow existing tables, forms, cards, modals, buttons, filters, and page patterns.

Before creating a new UI pattern, search the codebase for a similar component and reuse or extend it.

Do not redesign an existing screen unless the user explicitly requests it.

## Code Changes

Before editing, search the relevant implementation, understand dependencies, check for similar functionality, review regression risks in `KNOWN_ISSUES.md`, and check relevant decisions when architecture is involved.

Prefer existing utilities and components. Avoid duplicate logic, unnecessary dependencies, broad refactors, and rewriting working code without a clear reason.

Preserve backwards compatibility where practical. Never expose secrets or credentials. Preserve strict tenant isolation and authentication/authorization rules.

## Bug Fixes

When fixing a bug:

1. Identify the actual root cause.
2. Fix the root cause rather than hiding the symptom.
3. Check whether the same problem exists elsewhere.
4. Avoid changing unrelated working behavior.
5. Verify the fix.
6. Record meaningful regression knowledge.

For bugs that could be reintroduced, document what was broken, where it was broken, root cause, what changed, expected behavior, and what must not be changed in the future.

Use `KNOWN_ISSUES.md` and/or `CHANGELOG.md` as appropriate. Never knowingly reintroduce a documented bug.

## Architecture Changes

Do not change architecture merely because another approach appears cleaner.

If an established architecture or technical decision genuinely needs to change, check `DECISIONS.md`, explain why the existing decision no longer works, make the change only when required or explicitly requested, and record the new decision in `DECISIONS.md`.

Do not silently replace established architectural decisions.

## Documentation After Work

After meaningful work, update only the documentation that actually needs updating:

- `CURRENT_STATE.md` — current status or next steps changed.
- `CHANGELOG.md` — meaningful feature, fix, or implementation completed.
- `KNOWN_ISSUES.md` — new issue, warning, or regression knowledge.
- `DECISIONS.md` — architectural/technical decision made or changed.
- `PROJECT.md` — only when stable long-term project information changes.

Do not put routine history into `PROJECT.md`. Keep documentation concise and factual.

## Verification

Never claim something is fixed or completed merely because code was written.

Where possible, run relevant tests, type checking, lint/build, check affected flows, verify imports/dependencies, and check for obvious regressions.

Clearly distinguish between implemented, tested, not tested, and blocked. If something could not be verified, say so.

## Token Efficiency

Do not read every documentation file and large source file for every small task. Use targeted context. Search first, then read only relevant sections/files.

Keep documentation updates short and factual. Maintain enough persistent memory to prevent regressions without unnecessary token usage.

## Core Principle

**Preserve what already works. Understand before editing. Make the smallest safe change. Follow the existing YoTrack design and architecture. Record important knowledge so future work does not reintroduce old problems.**

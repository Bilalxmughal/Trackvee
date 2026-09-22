# AI Development Rules — YoTrack

## Purpose

These rules keep AI coding sessions consistent, prevent regressions, and reduce unnecessary token usage.

## Before changing code

1. Read `PROJECT.md` for stable architecture and rules.
2. Read `CURRENT_STATE.md`.
3. Read `KNOWN_ISSUES.md`.
4. Read only the relevant sections of `DECISIONS.md`.
5. Read the relevant source files before editing them.
6. Search the codebase for existing implementations before creating a new one.

Do **not** read every historical change by default. Use `CHANGELOG.md` only when the task needs historical context.

## While changing code

- Preserve existing working behavior unless the task explicitly changes it.
- Prefer the smallest safe change.
- Do not rewrite unrelated code.
- Do not introduce a new dependency when existing project dependencies can solve the problem.
- Do not duplicate existing utilities, services, types, or components.
- Check for previously fixed issues before modifying the same area.
- Do not change architecture, database strategy, protocol behavior, permissions, or major UX conventions without recording the decision.
- Never remove a workaround/fix just because it looks unnecessary; first understand why it exists.
- Protect tenant isolation and authentication/authorization rules.
- Do not expose secrets or hard-code credentials.

## UI / UX preservation rules

- Preserve the existing YoTrack design system, visual language, navigation structure, layouts, and user flows unless the user explicitly requests a specific change.
- New screens and features must look like part of the existing product, not a redesign. Reuse existing components and patterns wherever possible.
- Do not change the current Clean Light theme, primary red (`#dc2626`), typography, spacing conventions, sidebar behavior, table patterns, map styling, or status treatment unless explicitly requested.
- Use the project's existing icon system (Tabler Icons). Do not use emojis as UI icons or decorative elements in buttons, headings, cards, alerts, menus, empty states, status messages, or navigation.
- Avoid generic AI-generated dashboard aesthetics: unnecessary gradients, glassmorphism, excessive rounded cards, oversized hero sections, decorative blobs, excessive shadows, random illustrations, and ornamental UI that does not serve the product.
- Avoid generic AI-sounding interface copy such as overly enthusiastic greetings, filler text, or decorative messaging. UI copy should be concise, natural, professional, and appropriate for a vehicle tracking / fleet management product.
- Do not introduce status pills/badges when the existing design uses colored text or a colored left border for status.
- Do not change a page layout, navigation pattern, component hierarchy, or user journey merely because another design might look better. Functional tasks should remain functional changes.
- Before creating a new UI pattern, inspect existing screens/components and follow the closest established pattern.
- If a requested feature genuinely requires a new UX pattern or conflicts with the current design system, explain the conflict before making a broad redesign.

## After completing a task

Update documentation only when necessary:

### Feature implemented
Add a short entry to `CHANGELOG.md`.

### Bug fixed
Add a short entry to `CHANGELOG.md`. If the bug could easily return or has a non-obvious cause, also update `KNOWN_ISSUES.md` with the prevention rule or remove/update the issue entry if it is now resolved.

### Architecture / important decision
Add an entry to `DECISIONS.md`.

### Current project status changed
Update `CURRENT_STATE.md`.

### Nothing meaningful changed
Do not create documentation noise.

## Changelog format

Keep entries to 1–3 lines:

```md
## YYYY-MM-DD

### Added
- [Area] Short description.

### Fixed
- [Area] Short description and important cause/behavior.

### Changed
- [Area] Short description.
```

## Bug-fix memory rule

When fixing a bug, record:

- What was wrong
- Where it was
- What caused it, if known
- What behavior is now expected
- Any rule that prevents the bug from returning

Example:

```md
## KI-001 — Duplicate device packets

Status: Resolved

Area: apps/gateway

Cause:
The same packet could be processed more than once after reconnect.

Rule:
Packet handling must be idempotent for the same device message.
```

## Important

Do not claim a feature or fix is complete unless it was actually implemented and verified.

If verification was not possible, explicitly state that it remains unverified.

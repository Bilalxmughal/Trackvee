# Shared Patterns Index

This file is intentionally an index. Load only the pattern relevant to the task.

| Domain | Reference |
|---|---|
| Shared UI, modal sizing, dates, vehicle selectors | `docs/patterns/ui.md` |
| Live map, history, trip replay, vehicle menu, engine command | `docs/patterns/map.md` |
| Reports, filters, exports, saved reports | `docs/patterns/reports.md` |
| Users, custom permissions, role gating, auth separation | `docs/patterns/users-permissions.md` |
| Alerts, geofences, POIs, speed zones | `docs/patterns/alerts-geofences-pois.md` |
| Driver behavior leaderboard, detail and settings | `docs/patterns/driver-behavior.md` |
| Mobile Design 2, Expo baseline, navigation and screen flow | `docs/patterns/mobile.md` |

Cross-app rule: match the existing admin implementation in portal unless explicitly excluded. Portal stays light-theme only and uses inline styles plus the shared `api` client.

Use `docs/FEATURE_MATRIX.md` to check whether a feature already exists before starting implementation.

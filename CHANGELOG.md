# Changelog

> Concise history of meaningful implemented changes. Do not write long explanations here.

---

## 2026-09-22

### Fixed
- [Driver Behavior] Driver behavior page stuck loading — added axios 20s timeout and AbortController cleanup to prevent infinite spinner on slow/hanging API calls (`61f866d`).
- [Driver Behavior] Fixed `DISTINCT ON` 500 error on leaderboard endpoint — TypeORM query builder does not support PostgreSQL `DISTINCT ON`; replaced with raw `repo.query()` SQL (`9240a88`).
- [Gateway] Fixed old compiled code running on server after `git pull` without rebuild — established required deploy procedure: pull → build → restart.

### Added
- [Alerts] `low_score` alert type — fires once per vehicle per day when daily driver behavior score drops at or below configurable threshold (default: 70).
- [Alerts] `AlertsModal.tsx` wizard updated: `low_score` option with threshold input, score range hint, label and color.
- [Driver Behavior] `DriverBehaviorService` wired to `AlertsService` via `AlertsModule` import — low_score detection runs after daily score upsert.
- [Driver Behavior] Driver Behavior Scoring module — event detection (harsh brake, rapid accel, sharp turn, overspeed), daily score 0–100, leaderboard, 30-day history chart, per-org configurable settings.
- [Portal] "Users" page (renamed from "My Users" in client sidebar).

---

## 2026-09-22 (Baseline — project documentation added)

### Project State at Documentation Creation

The following modules were already implemented and production-deployed at this point:

**Infrastructure**
- Oracle Cloud VM: API (PM2, port 3000), PostgreSQL, Redis, TCP Gateway (port 5023)
- Vercel: admin portal (admin.trackvee.com), auto-deploys from main
- DNS: Hostinger, trackvee.com domain

**API (NestJS)**
- Auth: JWT, refresh tokens, role guards
- Users: internal staff roles (super_admin, admin, ops, live_ops, agent, chat_support, viewer)
- Organizations: multi-tenant B2B, org management
- Client Users: org user roles (client_owner, client_super_admin, client_admin, client_user)
- Vehicles: CRUD, org-scoped
- Devices: CRUD, IMEI-linked, org-scoped
- Gateway: TCP AT06 protocol, packet parsing, live state push
- Telemetry: ingestion, storage, live state (Redis), trip detection
- Alerts: 14 alert types, `alert_triggers` log, per-org config
- Geofences: circle + polygon, enter/exit/both, alert integration
- POIs: point-of-interest storage
- Cities: city-based vehicle filtering
- Role Portal Permissions: DB-backed client portal page access
- 14 SQL migration files applied

**Admin Portal (React)**
- 17 pages: Dashboard, Map, Vehicles, Devices, Telemetry, Alerts, Geofences, POIs, Driver Behavior, Clients, Client Users, Users, Roles, Settings, Setup, Login, Client Portal
- Map: live tracking, history playback, direction arrows, P-markers, vehicle search, geofence overlay
- Client Portal: org-user access with permission-controlled pages

**Documentation**
- AI development rules, project memory structure, decisions, known issues, changelog

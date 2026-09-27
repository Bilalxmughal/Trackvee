# Changelog

> Concise history of meaningful implemented changes. Do not write long explanations here.

---

## 2026-09-27

### Added
- [Mobile] Recorded the approved Trackvee Mobile Design 2, Expo SDK 57 baseline, primary navigation flow, mobile-specific requirements, and shared portal parity rules.
- [Mobile] Added the Expo SDK 57 app foundation: client-only secure login, refresh-token handling, permission-aware navigation, live OpenStreetMap fleet map, vehicle list/detail, alert rules, and grouped vehicle selection with server-generated report previews.

### Changed
- [Mobile] Anchored the login back control to the top safe area, kept welcome actions toward the bottom, and clarified network/server login errors while preserving generic credential errors.
- [Documentation] Replaced duplicated agent instructions with canonical `AGENTS.md` plus a minimal `CLAUDE.md` pointer, added task-based context routing, feature/deployment references, and split shared patterns into domain files to reduce context usage.
- [Documentation] Corrected stale current state: Reports and Audit Logs are complete, migrations are present through 021, and current product priorities are maintenance, device health, scheduled reports, and fuel monitoring.

## 2026-09-26 (Session 3)

### Added
- [API] Migration 018 deployed: `speed_zones` table (id, org_id, name, type, coordinates JSONB, speed_limit, color, created_at) on production DB.
- [Portal — PortalPermsContext] New context (`apps/portal/src/contexts/PortalPermsContext.tsx`): fetches `GET /role-portal-permissions`, scopes to logged-in user's role, exposes `canDo(feature, action): boolean`. Fallback hardcoded for network failure.
- [Portal — Layout] Topbar buttons (Alerts/Geofences/POIs/Behavior/Reports/Users) now conditionally rendered via `canDo`. Users button separated with divider.
- [Admin — roles.ts] `ORG_PORTAL_TOPBAR: PortalPageDef[]` added — single source of truth for topbar permission features (alerts, geofences, pois, driver-behavior, reports, users). `ORG_PORTAL_PAGES` trimmed to core 3 (dashboard, map, vehicles).
- [Admin — RoleAccessPage] Client Portal section: "Topbar Features" table added below pages table, mirrors Trackvee section pattern exactly. `toggleOrgTopbar()` handler added.
- [Portal — UsersModal] Restructured Add User modal to 3 tabs: Profile (unchanged), Vehicles (group-wise list from `/vehicle-groups`, toggle group/individual, all/specific radio), Permissions (dynamic from `canDo` — only shows features current user's role can grant).
- [Portal — UsersModal] `ALL_MODULES` array as single source of truth (portalKey → permKey mapping). Extended `OrgPerm` with `driverBehaviorView/Edit`, `reportsView`, `usersView/Add/Edit/Delete`.

---

## 2026-09-26 (Session 2)

### Added
- [Portal — DriverBehaviorModal] Clicking a leaderboard row now opens vehicle detail view (inline, same modal): summary tiles (Harsh Brake/Rapid Accel/Sharp Turn/Overspeed), 30-day SVG score chart, recent events table with severity, speed, time, and map pin → OSM iframe + Google Maps link.
- [Portal — UsersModal] Permissions tab redesigned to match admin: Permission Templates (View Only / Field Staff / Manager), Module Permissions as table (Module | VIEW | ADD | EDIT | DELETE with 26×26 icon-toggle cells, per-action color).
- [Portal — UsersModal] Profile tab: password show/hide eye icon, Active/Inactive status field (was missing — now saved in payload), tab renamed from "Info" → "Profile", field order matches admin (Role → First/Last Name → Email → Password → Status).
- [Portal — UsersModal] Permissions tab now available for ALL roles (Admin, Super Admin, User) — not just client_admin. client_owner excluded (fixed full access).
- [Auth] Login separation: internal admin roles cannot login to portal.trackvee.com, org user roles cannot login to admin.trackvee.com. Wrong-role login shows "Invalid email or password". Wrong-role token in storage is auto-cleared on page load.

### Fixed
- [Admin — MapPage] White screen crash caused by malformed geofence/speed-zone polygon data (undefined coordinates). Added null/undefined filter before `L.polygon()` call; shapes with < 3 valid points are skipped silently.

---

## 2026-09-26

### Added (Portal)
- [HistoryLayer] Red polyline (#dc2626), clickable blue SVG polygon arrow markers with async Nominatim address lookups, 26px P/I segment markers with popups, STOP (ignition-off) markers, green start / black end dots — all matching admin.
- [HistoryLayer] D-mode driving segment click now opens popup at midpoint: from/to timestamps + async addresses, duration, avg speed — same as admin.
- [DriverBehaviorModal] New full-screen popup (Behavior topbar button) with Driver Scores leaderboard tab and Settings tab — replacing the left-panel settings-only panel.
- [DriverBehaviorPanel] Fixed layout to horizontal row (label | input | unit), corrected units (km/h/s), corrected deduction labels to match admin.
- [VehicleMultiSelect] New portal component — search, vehicle groups with toggle, Select All / Deselect All with dash indicator, inline styles (light theme).
- [ReportsModal] Full rewrite: VehicleMultiSelect (multi-vehicle, group-aware), `/vehicle-groups` API, Period dropdown (Today/Yesterday/This Week/Last Week/This Month/Last Month), 13 report types, conditional Speed Limit / Min Stop / Min Speed, Group By dropdown, 2D-array row rendering, CSV export, summary row — matching admin filter logic.

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

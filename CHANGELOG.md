# Changelog

> Concise history of meaningful implemented changes. Do not write long explanations here.

---

## 2026-09-28

### Added
- [Mobile/API] Added opt-in Expo push registration, per-rule mobile-push delivery scoped by tenant, alert-view permission and vehicle access, and authenticated notification deep links to alert event details. Added migration 024 and push/event-access regression tests. Signed EAS credentials/build and device QA remain release prerequisites.
- [Mobile] Added the bundled Trackvee notification chime for Android channels and iOS push alerts; changing notification sound requires a new native build.
- [Mobile] Added permission-gated Geofence circle/polygon and POI management with map drawing, shared POI icon search, group filtering and CRUD. API Geofence/POI operations now enforce tenant scope and per-user permissions; added migration 023 for persisted Geofence enter/exit options and regression tests.
- [Mobile] Added dedicated selected-vehicle History and Replay routes with PKT custom date/time filters, route map controls, direction/stop markers, point details, virtualized history list, timeline scrubbing, replay seek and speed controls.
- [Mobile] Added a dedicated vehicle-scoped Alert page; vehicle alerts remain isolated through the selected-IMEI API routes.
- [Mobile] Vehicle View history arrows with tap details and PKT time, on-map replay controls with play/pause/scrub and range presets, related telemetry cards, and vehicle-specific alert rule management.
- [API] Migration 022 and vehicle-specific alert routes; shared/global alert rules split or exclude the selected IMEI during edit/delete.
- [API] Regression tests for shared-rule isolation, cross-tenant alert access, command authorization, empty vehicle access lists, and org-permission self/cross-tenant edits.
- [Mobile] Added permission-gated Driver Behavior leaderboard, vehicle event/score detail with 30-day chart, and editable organization settings.
- [Mobile] Added a compact 30-day daily-average fleet score line chart above Driver Behavior scores; API trend results honor tenant and custom vehicle access.
- [API] Enforced Driver Behavior role permissions and tenant/custom vehicle scope, whitelisted settings fields, kept score deletion internal-admin-only, and added authorization regression tests.

### Changed
- [Gateway] Valid GT06 GPS frames are acknowledged only after API persistence succeeds, with bounded retries/timeouts and serialized socket processing; reconnect cleanup no longer drops a newer socket. Admin and mobile live polling now reject stale overlapping results.
- [Mobile] Matched vehicle-group creation/edit selection to the client portal with searchable, collapsible Unassigned and existing-group sections, group-level checkboxes, per-vehicle selection, Select All and Deselect All. Moving a selected vehicle mirrors the portal's single-group membership behavior.
- [Mobile] Added permission-gated vehicle-group create, edit, membership selection and delete actions to Vehicles. Group edits retain memberships for vehicles outside the user's visible vehicle scope.
- [Mobile] Replay speed selection is now a flat borderless control. Vehicle list now groups vehicles from `/vehicle-groups`, filters by status and search, shows plate/name plus live telemetry, and provides Follow, Trip Replay, Last Hour/Today/Yesterday History, permission-gated Edit Alert and Engine Cut/Restore actions. The existing permission-gated Vehicles tab remains immediately after Map; History shortcuts apply Pakistan-time presets.
- [Documentation] Updated mobile status and parity matrix to distinguish implemented screens from missing mobile features and device/release verification.
- [Mobile] Centered the four live-map status metrics against their separators; zoom now derives the visible region from native map bounds for iOS and Android. Replay/History date and Load controls use one flat row, and History event details show one address, From/To times, and driving-consistent ignition.
- [Mobile] Added top spacing to the live-map fleet status cards, red active Follow state, screen-fitted Replay/History filters, centered speed-menu chevron, taller Replay controls and History rows, and camera-based live-map zoom.
- [Mobile] Prevented initial live-map zoom from using the stale Karachi default while the fleet fit is animating; restyled the four fleet status summaries as one docked band with short dividers.
- [Mobile] Increased Vehicle View sheet/action area and tightened its bottom inset. Removed Replay/History vehicle search, put Today/Yesterday/Last Week and From/To controls on one row, and added 12-hour AM/PM date-time selection.
- [Mobile] Replay car now shows speed; widened the speed menu. History event selection highlights driving paths green, uses red Parked markers, and shows From/To addresses/times and stop duration in content-sized details.
- [Mobile] Vehicle detail telemetry dividers, Google Maps coordinate action, non-banner Follow behavior, formatted odometer, taller action row, and Engine Cut icon action; corrected stop-duration lower-bound query when no moving sample exists.
- [Mobile] History and Replay now share vehicle search, PKT custom date/time pickers and Today/Last 24H/Yesterday/Week/Month presets. History groups route samples into Start/Driving/Idle/Parked/End events with times and stop durations; Replay uses larger media controls, track navigation, a speed dropdown, and an edge-safe seek bar.
- [Mobile] Removed the direction arrow's white background and removed Replay's 10s/30s controls.
- [Mobile] Reworked Vehicle View into a compact non-scrolling telemetry sheet with a coordinate-to-map action and separate Follow, Replay, History, Alert and Engine Cut actions; preserved its existing top bar.
- [Mobile] Main map zoom uses map region deltas; supported map styles and compact status cards, plus searchable/filterable/sortable vehicle list with the shared Engine Cut confirmation dialog.
- [API] Engine commands require role permission and access to the target vehicle; device/vehicle listings respect explicit empty vehicle access lists. Org-permission reads/writes now validate the target user, tenant and editable fields.

---

## 2026-09-27

### Added
- [Mobile] Recorded the approved Trackvee Mobile Design 2, Expo SDK 57 baseline, primary navigation flow, mobile-specific requirements, and shared portal parity rules.
- [Mobile] Added the Expo SDK 57 app foundation: client-only secure login, refresh-token handling, permission-aware navigation, live OpenStreetMap fleet map, vehicle list/detail, alert rules, and grouped vehicle selection with server-generated report previews.

### Changed
- [Mobile] Enlarged the live-map car icon, restored the Vehicles tab for roles with missing permission keys, and fixed iOS marker selection and map-to-vehicle navigation without weakening explicit access denials.
- [Mobile] Fixed vehicle-marker navigation by waiting for permissions and removing its native callout; moved search beside alerts, added Street/Satellite map types and right-side controls, and kept Vehicles after Map in navigation.
- [Mobile] Matched the map zoom-in control to the boxed zoom-out control while keeping the plus red; corrected vehicle marker heading, reduced its size, and made its live status color/dot update with telemetry. Selected speed now shows tenths of km/h and fleet polling runs every five seconds.
- [Mobile] Session restoration now caches the validated client profile and keeps it through temporary API/network failures. Refresh-token failures clear the session only when the server definitively rejects the token; client/admin role separation remains enforced.
- [Mobile] Corrected iPhone safe-area spacing on map and tabs, moved the login back control below the status bar, prevented bottom navigation clipping, and aligned map/report controls with Design 2.
- [Mobile] Anchored the login back control to the top safe area, kept welcome actions toward the bottom, and clarified network/server login errors while preserving generic credential errors.
- [API/Admin/Portal/Mobile] Unified live vehicle status from recent valid GPS samples with movement hysteresis and corrected stop duration to require a fresh confirmed stationary run.
- [Mobile] Matched map markers to the admin car asset, added heading rotation, short position interpolation, zoomed-out clustering, and a map-first vehicle detail sheet without changing main-map top controls.
- [API] Scoped telemetry stats, latest-position, and history endpoints to each client user's authorized devices.
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

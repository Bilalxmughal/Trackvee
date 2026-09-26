# Current State

> This file is the AI's quick project context. Keep it short and current.

## Last Updated

2026-09-26 (Session 4)

## Current Phase

**Feature Development — Production Active**

The platform is fully deployed and in active use. Phases 0–6 (core) are functionally complete.
Current work is ongoing feature additions on top of a stable production base.

## Infrastructure

- **API:** Oracle Cloud VM, PM2 (`yotrack-api`), port 3000, built TypeScript (`pnpm --filter api build`)
- **Frontend:** Vercel, auto-deploys from `main` branch (admin.trackvee.com)
- **Database:** PostgreSQL, 14 migrations applied, `synchronize: false`
- **Gateway:** TCP port 5023, AT06 protocol, deployed on Oracle Cloud

## Working / Completed

- Full NestJS API: auth, users, organizations, vehicles, devices, telemetry, alerts, geofences, POIs, cities, role-portal-permissions, driver-behavior
- 14 SQL migration files applied to production DB
- Admin portal (17 pages): Dashboard, Map (live + history), Vehicles, Devices, Telemetry, Alerts, Geofences, POIs, Driver Behavior, Clients, Client Users, Users, Roles, Settings, Setup
- Multi-tenant B2B: organizations with client roles (`client_owner`, `client_super_admin`, `client_admin`, `client_user`)
- Internal staff roles: `super_admin`, `admin`, `ops`, `live_ops`, `agent`, `chat_support`, `viewer`
- Client portal permissions system (DB-backed `role_portal_permissions` table + `OrgRolePermsContext`)
- Real device data flowing: ATS-GO / AOT06 devices connected via AT06 TCP protocol
- Driver Behavior Scoring: event detection (harsh brake, rapid accel, sharp turn, overspeed), daily score (0–100), leaderboard, 30-day history chart, configurable settings per org
- Alert system: 15 alert types including `low_score` and `speed_zone`; tow alert uses 15 km/h threshold + 2 consecutive packet check
- Speed Zones: circle + polygon zones with speed limit, draw tool, show/hide toggle, speed_zone alert type
- Map: live tracking, 3-state status (Moving/Idle/Parked at 5 km/h threshold), route history, direction arrows, P-markers, vehicle search
- Geofences: circle + polygon, enter/exit/both triggers
- POIs: point-of-interest markers on map
- **Trackvee manages client workflow**: admin selects a client from live map dropdown → all map operations (alerts, geofences, POIs, groups) are scoped to that client; backend supports `?orgId=` on all three endpoints; AlertsModal/AlertsLeftPanel/POIsPanel/GeofencesPanel all respect selected client

## Recently Completed (Session 4, 2026-09-26)

- **Admin `VehicleGroupSelect` component** created (`apps/admin/src/components/VehicleGroupSelect.tsx`) — 3-column grid, custom red checkbox (no row background highlight), group section headers, matches portal styling; used in AlertsModal and GeofencesModal
- **Custom checkbox style applied** across all vehicle selection lists (admin + portal): 15×15 red filled checkbox, white checkmark SVG, no row background on hover
- **Portal `UsersModal` `UserFormModal` size fix** — max-height and overflow corrected so the form doesn't clip
- **Bug fix: GeofencesModal crash** — `(gf.coordinates as PolygonCoords)?.points?.length ?? 0` guard in `filtered.map()` render; root cause: API data for client orgs could have `coordinates.points` undefined, causing "Cannot read properties of undefined (reading 'length')" at `Array.map`
- **Bug fix: AlertsModal null guards** — `(g.imeis ?? [])` in `flatMap` and `forEach`, `alert.vehicleImeis?.length ?? 0` in two render locations
- **Bug fix: MapPage alertsByImei builder** — `(alert.vehicleImeis ?? []).forEach(...)` in `useEffect` that re-runs when `selectedClientId` changes
- **Bug fix: VehicleGroupSelect null guards** — `_allImeis ?? []`, `g.imeis ?? []` for undefined props during panel transitions

## Recently Completed (Session 3, 2026-09-26)

- Migration 018 (`speed_zones` table) deployed on production server
- Portal topbar permissions: `PortalPermsContext` (fetches `role_portal_permissions` DB), topbar buttons (Alerts/Geofences/POIs/Behavior/Reports/Users) conditionally rendered via `canDo(feature, 'view')`
- Admin `RoleAccessPage`: Client Portal section now has "Topbar Features" table (mirrors Trackvee section) — `ORG_PORTAL_TOPBAR` array in `roles.ts` as source of truth
- Portal `UsersModal`: restructured into 3 tabs — Profile (unchanged), Vehicles (group-wise with plates, `/vehicle-groups` API), Permissions (dynamic from `canDo`, only shows what current user's role can grant)
- `ORG_PORTAL_TOPBAR` array added to `apps/admin/src/config/roles.ts` as single source of truth for topbar permission features

## In Progress / Pending Features

1. Maintenance Reminders (mileage/date-based service alerts)
2. Fuel Monitoring
3. Idle Time Alerts + Cost
4. Reports Module
5. Audit Logs

## Blocked

- Nothing currently blocking.

## Next

1. Implement Maintenance Reminders
2. Reports Module

## Important Context

- `synchronize: false` in TypeORM — all schema changes MUST go via SQL migration file in `apps/api/migrations/`
- `packages/types` resolves from `./src/index.ts` (not dist, which is gitignored)
- TypeORM query builder does NOT support `DISTINCT ON` — use `repo.query()` raw SQL
- Server runs compiled JS from `dist/` — `git pull` alone does NOT update running code; must rebuild
- Every new feature must be wired into client portal permissions in the same session it is built
- Portal permission flow: Admin RoleAccessPage → DB `role_portal_permissions` → Portal `PortalPermsContext` → `canDo(feature, action)` → UI conditional render → Add User modal inherits same scope so client admins can only grant what they themselves have

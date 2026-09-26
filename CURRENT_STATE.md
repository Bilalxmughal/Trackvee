# Current State

> This file is the AI's quick project context. Keep it short and current.

## Last Updated

2026-09-26 (Session 2)

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

## Recently Completed (Session 2, 2026-09-26)

- Portal DriverBehaviorModal: vehicle detail view on row click (tiles + ScoreChart + events table + OSM map)
- Portal UsersModal: Profile tab redesign (eye icon, Active/Inactive, field order), Permissions tab now table format with templates, available for all roles
- Admin MapPage: polygon crash fix (undefined coordinates in geofence/speed-zone data)
- Auth login separation: admin/portal roles strictly separated, wrong-role login silently blocked

## In Progress / Pending Features

See session memory `pending-features.md` for full list. Key upcoming items:
1. Maintenance Reminders (mileage/date-based service alerts)
2. Fuel Monitoring
3. Idle Time Alerts + Cost
4. Reports Module
5. Audit Logs

## Blocked

- Nothing currently blocking.

## Next

1. **Server: deploy migration 018** (`apps/api/migrations/018_speed_zones.sql`) + rebuild API
2. Implement Maintenance Reminders
3. Reports Module

## Important Context

- `synchronize: false` in TypeORM — all schema changes MUST go via SQL migration file in `apps/api/migrations/`
- `packages/types` resolves from `./src/index.ts` (not dist, which is gitignored)
- TypeORM query builder does NOT support `DISTINCT ON` — use `repo.query()` raw SQL
- Server runs compiled JS from `dist/` — `git pull` alone does NOT update running code; must rebuild
- Every new feature must be wired into client portal permissions in the same session it is built

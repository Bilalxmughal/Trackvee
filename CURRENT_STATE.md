# Current State

> This file is the AI's quick project context. Keep it short and current.

## Last Updated

2026-09-22

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
- Alert system: 14 alert types including `low_score` (fires once per vehicle per day when daily score drops below threshold)
- Map: live tracking, 3-state status (Moving/Idle/Parked at 5 km/h threshold), route history, direction arrows, P-markers, vehicle search
- Geofences: circle + polygon, enter/exit/both triggers
- POIs: point-of-interest markers on map

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

1. Run pending server commands for latest backend (low_score alert, driver-behavior AlertsModule):
   `git pull origin main → pnpm --filter api build → pm2 restart yotrack-api`
2. Implement Maintenance Reminders (#2 on pending list)

## Important Context

- `synchronize: false` in TypeORM — all schema changes MUST go via SQL migration file in `apps/api/migrations/`
- `packages/types` resolves from `./src/index.ts` (not dist, which is gitignored)
- TypeORM query builder does NOT support `DISTINCT ON` — use `repo.query()` raw SQL
- Server runs compiled JS from `dist/` — `git pull` alone does NOT update running code; must rebuild
- Every new feature must be wired into client portal permissions in the same session it is built

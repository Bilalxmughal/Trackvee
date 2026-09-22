# Technical Decisions

> Record decisions that should influence future implementation. Do not use this file for ordinary bug fixes.

---

## DEC-001 — PostgreSQL for persistent data

**Status:** Accepted

**Decision:**
Use PostgreSQL for all permanent data: vehicles, organizations, users, telemetry, alerts, geofences, driver behavior.

**Rule:**
Do not move permanent historical data to Redis.

---

## DEC-002 — Redis for live state / cache

**Status:** Accepted

**Decision:**
Use Redis for live vehicle state and short-lived cache.

**Rule:**
PostgreSQL remains the persistent source of truth.

---

## DEC-003 — AT06 over TCP on port 5023

**Status:** Accepted

**Decision:**
ATS-GO / AOT06 devices communicate with the YoTrack gateway using the AT06 TCP protocol on port 5023.

**Rule:**
Protocol changes must be deliberate and tested against actual device packets.

---

## DEC-004 — Strict tenant isolation

**Status:** Accepted

**Decision:**
B2B organizations must be isolated from one another at API and database levels.

**Rule:**
All queries against tenanted data must include `organizationId` filter. Never return cross-org data.

---

## DEC-005 — TypeORM synchronize: false

**Status:** Accepted

**Decision:**
TypeORM `synchronize` is disabled in production. All schema changes go through explicit SQL migration files in `apps/api/migrations/`.

**Reason:**
`synchronize: true` can cause destructive schema diffs in production. Manual migrations give full control and an auditable history.

**Rule:**
Every entity field change, new table, or index must be accompanied by a numbered SQL migration file (`0NN_description.sql`). Never enable synchronize in production.

---

## DEC-006 — Raw SQL for DISTINCT ON queries

**Status:** Accepted

**Decision:**
TypeORM query builder does not support PostgreSQL `DISTINCT ON`. Any query requiring it must use `repo.query()` with raw SQL.

**Reason:**
Attempting `DISTINCT ON` via query builder produces a syntax error 500 on PostgreSQL. Discovered during driver-behavior leaderboard implementation (commit `9240a88`).

**Rule:**
Use `repo.query()` for any query with `DISTINCT ON`. Document the raw SQL inline.

---

## DEC-007 — Vercel (frontend) + Oracle Cloud VM (API/DB/Gateway)

**Status:** Accepted

**Decision:**
- Admin portal deployed to Vercel, auto-deploys from `main` branch (admin.trackvee.com)
- API runs on Oracle Cloud VM via PM2, port 3000
- PostgreSQL and Redis on Oracle Cloud VM
- Gateway (TCP port 5023) on Oracle Cloud VM
- API proxied through nginx on the VM

**Reason:**
Vercel gives zero-config CDN and CI deploys for the React frontend. Oracle Cloud Free Tier provides a persistent VM for the long-running API, gateway, and database.

**Rule:**
Frontend changes auto-deploy on push to main. API changes require: `git pull → pnpm --filter api build → pm2 restart yotrack-api` on the server.

---

## DEC-008 — react-leaflet v4, not Google Maps

**Status:** Accepted

**Decision:**
Map is built with react-leaflet v4 (OpenStreetMap tiles). Google Maps is not used.

**Reason:**
No API key requirement, no usage billing, OSM tiles are free and suitable for fleet tracking.

**Rule:**
Do not upgrade react-leaflet (breaking API changes between major versions). Do not add Google Maps dependency.

---

## DEC-009 — Vehicle 3-state status model (Moving / Idle / Parked)

**Status:** Accepted

**Decision:**
Vehicle status is computed from live telemetry:
- **Moving**: speed ≥ 5 km/h
- **Idle**: speed < 5 km/h, ignition ON, last data < 5 min ago
- **Parked**: speed < 5 km/h, ignition OFF (or no recent data)

**Rule:**
Do not add more states without deliberate UI and DB migration planning. The 5 km/h threshold is intentional to filter GPS jitter.

---

## DEC-010 — packages/types resolves from source

**Status:** Accepted

**Decision:**
`packages/types` is a shared types package that resolves from `./src/index.ts` in the monorepo. `dist/` is gitignored.

**Rule:**
Import shared types via `@yotrack/types`. Do not reference the types dist folder. The monorepo tsconfig paths handle resolution.

---

## DEC-011 — DB-backed client portal permissions

**Status:** Accepted

**Decision:**
Client portal page/feature access is controlled via the `role_portal_permissions` table, not hardcoded. Each org role (`client_owner`, `client_super_admin`, `client_admin`, `client_user`) has rows per page/feature, defaulting to sensible values in the migration.

**Reason:**
Allows orgs to customize what their users can see. `client_owner` can modify their org's role permissions.

**Rule:**
Every new feature/page added to the platform must also add rows to the migration default inserts for all four client roles.

---

## DEC-012 — Low score alert fires once per vehicle per day

**Status:** Accepted

**Decision:**
`low_score` alerts use an in-memory Map keyed by `vehicleId:YYYY-MM-DD` to prevent repeated firing on the same vehicle/day.

**Reason:**
Driver score is recalculated continuously as telemetry arrives. Without a cooldown, the alert would fire on every telemetry packet when score is below threshold.

**Rule:**
Cooldown map lives at module level in `driver-behavior.service.ts`. It resets on server restart (daily PM2 restarts are acceptable for this use case).

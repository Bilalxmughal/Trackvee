# Known Issues

> Keep only active issues and important resolved issues whose cause/rule matters for future development.

---

## KI-001 — Server must be rebuilt after every git pull

**Status:** Active (operational constraint)

**Area:** API / Deployment

**Problem:**
PM2 runs compiled JS from `dist/`. `git pull origin main` alone does NOT update what PM2 runs. New source code changes will not take effect until the API is rebuilt.

**Required action (every deploy):**
```
git pull origin main
pnpm --filter api build
pm2 restart yotrack-api
```

**Rule:**
Never announce an API fix as "deployed" until `pnpm --filter api build` has run on the Oracle server.

---

## KI-002 — TypeORM query builder does not support DISTINCT ON

**Status:** Active (permanent limitation)

**Area:** API / Database queries

**Problem:**
PostgreSQL `DISTINCT ON` syntax causes a 500 error when attempted through TypeORM's query builder. Observed in driver-behavior leaderboard query (`9240a88`).

**Rule:**
Any query requiring `DISTINCT ON` must be written using `repo.query()` raw SQL. Do not attempt `DISTINCT ON` via query builder.

---

## KI-003 — pg deprecation warning: "Calling client.query() when already executing"

**Status:** Monitoring (not breaking)

**Area:** API / Database / Driver Behavior

**Problem:**
Under concurrent telemetry ingestion, the `pg` driver logs a deprecation warning about calling `client.query()` when already executing. This originates from driver behavior processing running DB queries during high-frequency telemetry bursts.

**Rule:**
Not breaking, but indicates connection pool pressure. Monitor if query errors start appearing. Will need a connection pool tuning pass if volume increases.

---

## KI-004 — packages/types resolves from source, not dist

**Status:** Active (build configuration)

**Area:** Monorepo / TypeScript

**Problem:**
`packages/types` is configured to resolve from `./src/index.ts` in the monorepo. The `dist/` folder is gitignored. If anything imports the types package expecting a compiled dist, it will fail.

**Rule:**
Always import from `@yotrack/types` (resolved via monorepo tsconfig paths). Do not reference `packages/types/dist` directly.

---

## KI-005 — react-leaflet must stay at v4

**Status:** Active (dependency constraint)

**Area:** Frontend / Map

**Problem:**
The admin portal map uses react-leaflet v4 API. v3 and v5 have breaking API differences. Custom `DivIcon` markers require the `leaflet-interactive` CSS class to receive pointer events.

**Rule:**
Do not upgrade react-leaflet. Do not remove `className="leaflet-interactive"` from custom DivIcon markers.

---

## KI-006 — Client portal permissions must be wired for every new feature

**Status:** Active (process rule)

**Area:** Client Portal / Permissions

**Problem:**
The client portal uses a DB-backed permission system (`role_portal_permissions` table). New features not added to `ORG_PORTAL_PAGES` + DB defaults will be inaccessible to org users.

**Rule:**
Every new feature/page built in the same session must also be wired into `ORG_PORTAL_PAGES`, the DB migration default rows, and any `canOrgDo` guards before closing the task.

---

## KI-007 — Live status flickered on isolated low-speed GPS fixes

**Status:** Resolved; regression rule retained

**Area:** API / Admin Map / Client Portal / Mobile

**Cause:** Each client classified the latest raw speed independently, so a single noisy/deceleration fix could change Moving to Idle/Parked. Stop duration was also vulnerable to stale or unconfirmed samples.

**Rule:** Use the API's shared `vehicleStatus` from recent valid GPS fixes. Keep the 5 km/h movement entry threshold, confirm stopped state with consecutive low-speed fixes, and only calculate stop duration from a fresh confirmed stationary run. Keep status and stop-duration regression checks aligned across API, admin, portal, and mobile.

---

## KI-008 — Mobile marker tap returned to Map

**Status:** Resolved; regression rule retained

**Area:** Mobile navigation / map markers

**Cause:** Native marker `title`/`description` opened a transient callout, while vehicle detail checked `vehicles` permission before the asynchronous role-permission request finished and redirected to Map.

**Rule:** Navigating markers must use their press handler without a native callout. Detail screens must wait for permission loading to finish before redirecting unauthorized users.

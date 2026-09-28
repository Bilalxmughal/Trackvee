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

**Rule:** Navigating markers must use their press/select handler without a native callout. A live-map vehicle detail uses `map.view`; the Vehicles tab uses `vehicles.view`. Wait for permission loading before redirecting. Merge missing role-permission keys from defaults without overriding explicit denials.

---

## KI-009 — Vehicle-scoped alert actions and device commands

**Status:** Resolved; API regression tests passed and migration 022 was applied in production

**Area:** API / Mobile vehicle detail

**Cause:** Shared/global alert rules could affect other vehicles when edited or deleted for one IMEI. Device commands previously accepted an IMEI without checking the caller's vehicle access and engine-cut permission; an empty vehicle access list could be treated as all vehicles. The org-permissions route also accepted an arbitrary target user and organization.

**Rule:** Apply migration 022 before the new API starts. Vehicle alert mutation must lock and split/exclude only the selected IMEI; tests must cover shared/global rules and cross-tenant access. Device commands and telemetry must derive permitted devices from the authenticated user; `vehicleIds: []` means no vehicles, while `null` means all organization vehicles. Permission reads/writes must validate the target user and tenant; never accept a client-supplied organization or record-owner field.

---

## KI-010 — Stop duration needs the first stationary sample

**Status:** Resolved; regression rule retained

**Area:** API / Vehicle detail / Mobile

**Cause:** When a vehicle had no prior moving sample, the stationary query used the first valid GPS timestamp as an exclusive lower bound. That dropped the first stationary fix and could leave a genuine stop with too few samples to calculate a duration.

**Rule:** When no moving fix exists, make the lower bound precede the first valid sample. Continue requiring at least two fresh stationary samples and break stationary runs across gaps greater than ten minutes; never infer a stop duration from stale or unconfirmed data.

---

## KI-011 — Live map zoom used a stale region during fleet fit

**Status:** Resolved; regression rule retained

**Area:** Mobile live map

**Cause:** Zooming from `camera.zoom` did not work with the iOS native map provider, while cached region values could be stale during fleet fitting.

**Rule:** Read the visible native map boundaries and zoom with `animateToRegion`; keep region refs synchronized from native callbacks and use the cached region only as an error fallback. Never depend on Google-only camera zoom for iOS.

---

## KI-012 — Gateway acknowledged GPS before persistence

**Status:** Resolved in source; production verification pending

**Area:** Gateway / API / Live tracking

**Cause:** The GT06 gateway sent a GPS ACK immediately and persisted asynchronously. A transient API/database failure after the ACK could silently discard that fix. Admin polling could also overlap and let an older response replace a newer point.

**Rule:** Await bounded API persistence before ACKing valid GPS frames; serialize socket parsing and close without ACK after persistence retries fail. Keep client poll requests serial or discard stale responses. Confirm Oracle gateway deployment and inspect live telemetry timestamps after release; UI polling cannot compensate for a tracker configured to report infrequently.

---

## KI-013 — Geofence and POI CRUD must enforce tenant and module access

**Status:** Resolved; API regression tests added

**Area:** API / Mobile / Admin / Client Portal

**Cause:** Client Geofence and POI list/mutation handlers did not consistently enforce organization scope and per-user View/Add/Edit/Delete permissions. Create/update bodies could also include record ownership fields.

**Rule:** Derive a client user's organization only from the authenticated user, scope every client lookup and mutation by that organization, and enforce role defaults plus explicit OrgPerm overrides for each action. Whitelist editable fields and never accept client-supplied `id` or `orgId` as ownership. Keep regression tests for denial, cross-tenant access and ownership spoofing.

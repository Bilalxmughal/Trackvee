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

Alert-rule list responses must also be organization- and vehicle-scoped: remove inaccessible IMEIs, and advertise edit/delete only when the caller can manage the rule's full target scope. A restricted vehicle user must never receive a fleet-wide write capability.

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

**Production verification:** A 2026-09-29 Oracle log sample shows the ATS-GO IMEI producing valid GPS frames that the active GT06 gateway parses and persists, so the protocol-name mismatch in product docs/source is not evidence that this device's frames are being rejected. In that sample, tracker timestamps lag gateway receipt by about 80–111 seconds for one batch and 10–14 seconds later; API persistence follows gateway receipt in about 6–11 ms. Socket read timeouts also recur. Continue checking DB packet intervals and device/cellular send behavior; reconcile the documented AT06 label with the protocol that actually works before changing protocol code.

---

## KI-013 — Geofence and POI CRUD must enforce tenant and module access

**Status:** Resolved; API regression tests added

**Area:** API / Mobile / Admin / Client Portal

**Cause:** Client Geofence and POI list/mutation handlers did not consistently enforce organization scope and per-user View/Add/Edit/Delete permissions. Create/update bodies could also include record ownership fields.

**Rule:** Derive a client user's organization only from the authenticated user, scope every client lookup and mutation by that organization, and enforce role defaults plus explicit OrgPerm overrides for each action. Whitelist editable fields and never accept client-supplied `id` or `orgId` as ownership. Keep regression tests for denial, cross-tenant access and ownership spoofing.

---

## KI-014 — Driver Behavior APIs must honor tenant and vehicle access

**Status:** Resolved; API regression tests added

**Area:** API / Mobile / Driver Behavior

**Cause:** Role-gating a mobile screen alone does not prevent direct API access to another tenant's vehicle data or scores outside a user's custom vehicle grant.

**Rule:** Enforce `driver-behavior` role access in the API, scope every client vehicle/group/settings lookup to the authenticated organization, apply custom `vehicleIds` to leaderboard and detail routes, whitelist editable settings, and keep score deletion internal-admin-only.

---

## KI-015 — Mobile push tokens and event links must stay scoped

**Status:** Active deployment prerequisite; source implemented

**Area:** API / Mobile notifications

**Problem:** Push-token ownership, alert delivery, or a notification event lookup could expose another user's or tenant's vehicle activity if recipient and deep-link access are not revalidated.

**Rule:** Apply migration `024_mobile_push_tokens.sql` before deploying the API. Bind token registration/removal to the authenticated user and organization. Send only to active client users with effective `alerts.view` and access to the triggering vehicle; recheck the same scope on event detail fetch. Never rely on the notification payload as authorization. Native push also requires the configured EAS project and APNs/FCM credentials.

---

## KI-016 — Android notification sound resources cannot contain hyphens

**Status:** Resolved; regression rule retained

**Area:** Mobile / Android EAS prebuild

**Cause:** Expo's Android notification config plugin turns bundled sound filenames into Android resource names, which reject hyphens.

**Rule:** Name custom Android notification sound files with lowercase letters, digits, and underscores only (for example, `trackvee_alert.wav`). Keep the filename identical in the Expo plugin config, Android notification channel, and push payload; verify with `expo prebuild --platform android` before starting an EAS build.

---

## KI-017 — Authenticated back navigation must not reveal onboarding

**Status:** Resolved; regression rule retained

**Area:** Mobile authentication / navigation

**Cause:** The public Get Started route remained in the root stack after login, so native back navigation could reveal onboarding while the user was authenticated.

**Rule:** On successful sign-in or authenticated startup from a public route, dismiss the public stack history before replacing the route with `/map`. Test Android hardware back and iOS swipe-back from the authenticated root.

---

## KI-018 — Per-alert mobile sounds require provisioned native channels

**Status:** Shared sound catalogue implemented; migrations, one EAS release and device QA required

**Area:** API / Mobile push notifications

**Cause:** Android notification channel sound is immutable, and older app builds only register the original Trackvee channel. Sending a newly selected sound to an old channel silently plays the old sound or no sound.

**Rule:** Apply migrations 025 and 026 before deploying the API. The mobile app must create built-in channels and install active uploaded tones before registering sound capability and installed IDs. Keep legacy fallback for tokens without that capability or an uploaded sound. Uploaded tones are global catalogue records managed only by internal sound managers; client reads require effective `alerts.view`. One EAS build is needed to install the native runtime module; subsequent tone uploads do not require a rebuild. Validate Android and iOS custom-tone delivery on physical devices.

---

## KI-019 — Mobile organization user grants require migration 027

**Status:** Active deployment prerequisite

**Area:** API / Mobile Users / Client permissions

**Problem:** Mobile Users adds nullable per-user grants for Driver Behavior, Reports, and Users. The API entity expects these columns, so deploying the API before the production database migration can fail permission queries.

**Rule:** Apply `apps/api/migrations/027_extended_user_permissions.sql` to production before rebuilding/restarting `yotrack-api`. Keep `NULL` as role-default inheritance; `false` is an explicit denial. User CRUD and permission writes must continue enforcing organization, role hierarchy, action grant bounds, and vehicle scope in the API.

---

## KI-020 — Mobile push preferences must remain device- and tenant-scoped

**Area:** API / Mobile notifications

**Problem:** A client may change sound behavior only for its own registered push token. A caller-supplied token must never allow changing another account's notification preferences.

**Rule:** Require effective `alerts.view`, validate the Expo token, and update only the row matching authenticated user ID, organization ID, and token. Combine the per-device sound preference with the alert rule's sound setting. Default existing registrations to sound enabled through migration `028_mobile_push_preferences.sql`.

---

## KI-021 — Maintenance distance reminders are approximate

**Status:** Active product constraint

**Area:** Maintenance / Odometer reminders

**Problem:** The current tracker telemetry does not expose a verified cumulative odometer field. Distance since service is calculated from the user-entered service odometer and GPS displacement, which can be incomplete or noisy.

**Rule:** Keep GPS-derived mileage labeled Estimated, require the entered service odometer baseline before evaluating distance thresholds, and never represent the estimate as an authoritative odometer. Date reminders work independently. Apply migration `029_maintenance_records.sql` before deploying the API.

**Alert timing:** Service-type alert rules evaluate on the vehicle's next valid telemetry packet. They do not currently run from a wall-clock scheduler, so a vehicle that stops reporting will not receive an alert exactly at its due time until reporting resumes.

---

## KI-022 — Cross-module Nest providers must be exported

**Status:** Regression rule

**Area:** API / NestJS module wiring

**Problem:** The API failed to bootstrap when `TelemetryService` injected `MaintenanceService` from `MaintenanceModule`; importing the module alone does not expose its provider.

**Rule:** Any provider injected by a different Nest module must be listed in the owning module's `exports`. Verify module dependency injection at application startup, not only with TypeScript compilation.

---

## KI-023 — Mobile maintenance distance selection is an interval

**Status:** Regression rule

**Area:** Mobile / Maintenance reminders

**Problem:** The mobile service form offers 500–10,000 km steps. Persisting the selected step as an absolute due odometer makes a vehicle whose current estimated odometer is already higher appear overdue even when its due date is in the future.

**Rule:** Treat the selected value as distance after service. Require the entered service odometer and persist `serviceOdometerKm + selectedIntervalKm` as `nextDueOdometerKm`. The API correctly marks a record overdue when either its due date has passed or its estimated current odometer has reached the absolute due odometer.

---

## KI-024 — GT06 CRC warnings from the wrong checksum variant

**Status:** Fixed in source; Oracle deployment verification pending

**Area:** Gateway / GT06 protocol

**Cause:** The parser calculated CRC-16/IBM (`0xA001`), but captured GT06 login, heartbeat, and GPS frames use CRC-ITU/X-25 (`0x8408`, init/final XOR `0xFFFF`). It logged false non-fatal mismatch warnings while still processing packets.

**Rule:** Keep checksum coverage from the length byte through the serial number and keep the captured frames' big-endian checksum byte order. Do not reject frames or alter GPS ACK behavior for this fix. After deployment, verify CRC warnings stop while GPS persistence and tracker ACKs continue.

---

## KI-025 — Raw device identifiers must not appear in client UI

**Status:** Regression rule

**Area:** Client portal and mobile privacy

**Problem:** Raw tracker IMEIs can leak through device lists, health panels, fallback vehicle labels, search, reports, notification details, or command prompts.

**Rule:** Treat IMEI as an internal API/route key only. Never render, search, export, or use it as a client-facing fallback; use a vehicle plate/name, display ID, or generic vehicle label. Review portal and mobile UI whenever a device response is added to a screen.

---

## KI-026 — Legacy device installation dates are estimated

**Status:** Active until migration 031 is applied

**Area:** Device inventory / vehicle history / reports

**Problem:** Before assignment history existed, the database stored only the current `devices.vehicle_id`. Migration 031 backfills the current link starting at the earliest retained telemetry point (or device creation time when no points exist); that cannot recover the actual historical installation or replacement date.

**Rule:** Apply `031_device_assignment_and_vehicle_lifecycle.sql` before deploying the API. Treat rows with action `legacy` as approximate installation history. For all new assignment, transfer, and replacement actions, write a time-bounded assignment record transactionally. Reports must attribute packets by tracker timestamp within the assignment interval and must not infer past ownership from the current device link.

---

## KI-027 — Device inventory SQL must account for legacy owner ID types

**Status:** Resolved; regression rule retained

**Area:** Admin / Device inventory

**Cause:** The inventory query joined UUID `users.id` directly to text `vehicles.owner_id`, causing PostgreSQL to reject the query and return HTTP 500 for every inventory request. The owner field also represents the vehicle's record owner, not necessarily the current operational owner.

**Rule:** Do not join/display `vehicles.owner_id` for the device inventory list. Cast incoming city, organization, and user filter IDs to UUID in raw SQL predicates; preserve the client-user permission filter independently of display columns.

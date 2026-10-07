# Current State

Last verified: 2026-10-07 (Short-gap stop estimates are implemented across admin, portal, and mobile source; mobile typecheck passes. Admin/portal builds and production verification remain pending because local dependencies are incomplete; tracker GPS/GPRS cadence still needs device-side verification.)

## Status

YoTrack is production-active. Core API, gateway, admin portal, and client portal are operational. Current work is feature expansion on a stable multi-tenant base.

## Production architecture

- API: Oracle Cloud VM, PM2 process `yotrack-api`, port 3000.
- Gateway: Oracle Cloud VM, PM2 process `yotrack-gateway`, TCP port 5023.
- Database: PostgreSQL, TypeORM `synchronize: false`.
- Frontends: Vite admin and portal projects deployed from `main` through Vercel.
- Repository on Oracle: `~/yotrack`.

## Completed product areas

- Authentication with strict admin/client portal role separation.
- Multi-tenant organizations, users, custom module permissions, and vehicle-level access.
- Live tracking, map history, trip replay, vehicle groups, engine commands, and tracking-expiry badge.
- Mobile includes client-only authentication, permission-aware Map/Vehicles/Alerts/Reports/More navigation, grouped/searchable Vehicles with permission-gated CRUD and menu actions, live map, vehicle detail, vehicle-scoped and fleet-wide alert rule management with custom vehicle scope enforced by API list responses, PKT History/Replay, all 13 report types with grouped vehicle selection, custom PKT dates, conditional filters, grouping, saved filters and CSV sharing, permission-gated Geofence/POI management, Driver Behavior with a compact 30-day fleet trend, leaderboard, detail/chart and settings, and organization Users with scoped CRUD, vehicle restrictions and custom permissions. More now includes per-device push/sound preferences and optional refresh on foreground return; fleet polling pauses in background. New mobile alert rules default to mobile push enabled; Add/Edit Alert is a safe-area-aware router screen with native back gestures and a keyboard-safe action. Mobile push registration, per-rule push delivery, and tenant/vehicle-scoped notification event deep links are implemented in source. Remaining parity and release gaps are listed in `docs/FEATURE_MATRIX.md`.
- Shared live status and confirmed stop-duration handling across API, admin, portal, and mobile; mobile map clustering, animated vehicle positions, and map-first vehicle detail.
- History and Replay across API, admin, portal, and mobile retrieve dense date ranges in deterministic offset pages, filter unusable GPS fixes, and avoid counting long location jumps as parked time; START is green, END red, and parked `P` black.
- Device Health Center is implemented across API, admin, client portal, and mobile source. Oracle API build/restart and portal build completed on 2026-09-29; production tenant/vehicle-scope behavior and physical-device mobile QA remain pending.
- Device inventory separates stock state from tracker connectivity, records time-bounded assignment/replacement history, and attributes reports by tracker time. Assignment, replacement, removal, and history are managed from Vehicle details; Devices is inventory-only with total/assigned/in-stock counts. Removing a tracker expires the vehicle; portal map markers/live counts exclude it while the left panel shows an `Expired` row. Admin Vehicles includes lifecycle counts, searchable client/device controls, tracking-expiry filters, and named actions. Apply migrations 031–033 before API deployment; legacy installation dates are approximate. Per-user permissions cover all 10 portal areas, with a separate configurable B2C role profile.
- GT06 CRC-ITU/X-25 verified against 109 captured production frames; valid GPS ACK follows confirmed API persistence with bounded retry. Oracle gateway still needs the CRC fix deployed and live logs checked.
- Vehicles, devices, telemetry, alerts, geofences, POIs, speed zones, driver behavior scoring, and vehicle service history with due-date and estimated-distance reminders.
- Reports in admin and portal: 13 report types, vehicle groups, period/conditional filters, CSV/Excel/Print, saved reports.
- Scheduled Report Delivery in API/admin/portal source: reusable report templates with saved filters/vehicles, custom PKT report windows or rolling periods, delivery time, up to 10 extra recipients, and Active/Pause/Edit/Delete management. Production activation requires migration 030 and Resend credentials; one live email remains to be verified after setup.
- Audit logs for internal operations.
- Client portal topbar permission gating through DB-backed role portal permissions.
- SQL migrations present through `032_vehicle_device_lifecycle_reason.sql`; migrations 025–032 must be applied before deploying the current API. Shared alert sounds can be uploaded/activated in Admin and selected in Admin, Portal, and Mobile. Mobile supports per-device push/sound preferences and optional fleet refresh on foreground return; live polling pauses while backgrounded. One EAS build containing the local native dynamic-sound module is required; later catalogue uploads do not require a rebuild. Android signing/FCM and iOS APNs credentials, native build, and physical-device delivery QA remain release prerequisites.

## Active constraints

- Every schema change requires a migration.
- API/gateway production changes require build plus PM2 restart after pull.
- Every new client-facing page/feature must be configured for both B2B and B2C role profiles, role-management controls, and UI/API guards as applicable; B2B grants do not imply B2C access.
- Synthetic live-tracking test fleet `LOADTEST sep30a` is retained in production after 10/50/100/300-device stages passed at 30-second intervals (1,840 ACKed packets, zero session failures). Do not clean it up until the user says load testing is complete; reuse the staged runbook in `docs/LOAD_TESTING.md` for further tests.
- Preserve react-leaflet v4 and custom marker pointer-event behavior.
- Use raw SQL for PostgreSQL `DISTINCT ON` queries.
- Pending discussion: review Oracle VM shape and monthly cost with the user; do not resize or change the production instance before that discussion.
- Admin live-map performance optimizations are pushed to `main`; production browser verification with a 300-vehicle fleet remains pending.

## Next product priorities

1. Complete Trackvee mobile release readiness and physical-device QA; see `docs/FEATURE_MATRIX.md` for exact gaps.
2. Fuel monitoring and cost analytics.
3. Production delivery check for scheduled reports after Oracle configuration.

## Blockers

Mobile foundation is in progress. Android export is verified; native-device interaction, remaining mobile parity, signed EAS builds, and store distribution setup remain. Production maintenance also requires migration 029 before the API restart.

Scheduled report delivery is coded but needs migration 030 and Resend sender/API key before production activation. Verify one delivery and pause/resume after setup. Gateway CRC-ITU/X-25 fix is pushed in commit `33f4685`; check deployment status separately if it remains outstanding.

See `docs/FEATURE_MATRIX.md` for feature parity and `KNOWN_ISSUES.md` for operational/regression constraints.

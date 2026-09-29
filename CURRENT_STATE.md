# Current State

Last verified: 2026-09-29 (API/mobile TypeScript checks pass. Admin/portal checks still report existing Tabler icon React-type incompatibilities. Maintenance forms and service-type alert configuration are implemented; migration 029 is required before API deployment. Maintenance alert evaluation waits for the vehicle's next valid telemetry packet. Physical-device push-tone testing remains pending.)

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
- GT06 valid GPS ACK now follows confirmed API persistence with bounded retry; admin/mobile polling reject stale overlapping results. Production gateway behavior still needs Oracle deployment and timestamp/log verification.
- Vehicles, devices, telemetry, alerts, geofences, POIs, speed zones, driver behavior scoring, and vehicle service history with due-date and estimated-distance reminders.
- Reports in admin and portal: 13 report types, vehicle groups, period/conditional filters, CSV/Excel/Print, saved reports.
- Audit logs for internal operations.
- Client portal topbar permission gating through DB-backed role portal permissions.
- SQL migrations present through `029_maintenance_records.sql`; migrations 025–029 must be applied before deploying the current API. Shared alert sounds can be uploaded/activated in Admin and selected in Admin, Portal, and Mobile. Mobile supports per-device push/sound preferences and optional fleet refresh on foreground return; live polling pauses while backgrounded. One EAS build containing the local native dynamic-sound module is required; later catalogue uploads do not require a rebuild. Android signing/FCM and iOS APNs credentials, native build, and physical-device delivery QA remain release prerequisites.

## Active constraints

- Every schema change requires a migration.
- API/gateway production changes require build plus PM2 restart after pull.
- Every client-facing feature must be added to portal role permissions and UI guards.
- Preserve react-leaflet v4 and custom marker pointer-event behavior.
- Use raw SQL for PostgreSQL `DISTINCT ON` queries.

## Next product priorities

1. Complete Trackvee mobile parity and release readiness; see `docs/FEATURE_MATRIX.md` for exact gaps.
2. Device health center.
3. Scheduled report delivery.
4. Fuel monitoring and cost analytics.

## Blockers

Mobile foundation is in progress. Android export is verified; native-device interaction, remaining mobile parity, signed EAS builds, and store distribution setup remain. Production maintenance also requires migration 029 before the API restart.

See `docs/FEATURE_MATRIX.md` for feature parity and `KNOWN_ISSUES.md` for operational/regression constraints.

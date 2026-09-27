# Current State

Last verified: 2026-09-28 (API/mobile typechecks, API build, Android and iOS Expo exports; native device interaction pending).

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
- Shared live status and confirmed stop-duration handling across API, admin, portal, and mobile; mobile map clustering, animated vehicle positions, and map-first vehicle detail.
- Vehicles, devices, telemetry, alerts, geofences, POIs, speed zones, and driver behavior scoring.
- Reports in admin and portal: 13 report types, vehicle groups, period/conditional filters, CSV/Excel/Print, saved reports.
- Audit logs for internal operations.
- Client portal topbar permission gating through DB-backed role portal permissions.
- SQL migrations present through `022_alert_vehicle_exclusions.sql`; migration 022 must be applied before deploying the new API build.

## Active constraints

- Every schema change requires a migration.
- API/gateway production changes require build plus PM2 restart after pull.
- Every client-facing feature must be added to portal role permissions and UI guards.
- Preserve react-leaflet v4 and custom marker pointer-event behavior.
- Use raw SQL for PostgreSQL `DISTINCT ON` queries.

## Next product priorities

1. Complete Trackvee mobile parity: trip history/replay, alert and map-zone management, behavior, user permissions, and notification preferences.
2. Maintenance reminders and service history.
3. Device health center.
4. Scheduled report delivery.
5. Fuel monitoring and cost analytics.

## Blockers

Mobile foundation is in progress. Native build/export is verified; physical iOS/Android interaction, production migration 022, full portal feature parity and store distribution setup remain.

See `docs/FEATURE_MATRIX.md` for feature parity and `KNOWN_ISSUES.md` for operational/regression constraints.

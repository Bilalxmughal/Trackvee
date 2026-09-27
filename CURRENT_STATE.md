# Current State

Last verified: 2026-09-27, commit `505466d`.

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
- Vehicles, devices, telemetry, alerts, geofences, POIs, speed zones, and driver behavior scoring.
- Reports in admin and portal: 13 report types, vehicle groups, period/conditional filters, CSV/Excel/Print, saved reports.
- Audit logs for internal operations.
- Client portal topbar permission gating through DB-backed role portal permissions.
- SQL migrations present through `021_org_tracking_expiry.sql` (18 migration files because numbering begins at 004).

## Active constraints

- Every schema change requires a migration.
- API/gateway production changes require build plus PM2 restart after pull.
- Every client-facing feature must be added to portal role permissions and UI guards.
- Preserve react-leaflet v4 and custom marker pointer-event behavior.
- Use raw SQL for PostgreSQL `DISTINCT ON` queries.

## Next product priorities

1. Maintenance reminders and service history.
2. Device health center.
3. Scheduled report delivery.
4. Fuel monitoring and cost analytics.

## Blockers

None recorded.

See `docs/FEATURE_MATRIX.md` for feature parity and `KNOWN_ISSUES.md` for operational/regression constraints.

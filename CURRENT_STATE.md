# Current State

Last verified: 2026-09-28 (mobile typecheck and Android Expo export pass with Expo Audio 57; Android native prebuild succeeds and confirms no microphone permission is added; migration 025 and a new EAS binary are required before real-device push-tone testing; Android signing/FCM credentials and device QA remain).

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
- Mobile includes client-only authentication, permission-aware Map/Vehicles/Alerts/Reports/More navigation, grouped/searchable Vehicles with permission-gated CRUD and menu actions, live map, vehicle detail, vehicle-scoped and fleet-wide alert rule management with custom vehicle scope enforced by API list responses, PKT History/Replay, grouped report preview, permission-gated Geofence/POI management, and Driver Behavior with a compact 30-day fleet trend, leaderboard, detail/chart and settings. New mobile alert rules default to mobile push enabled; Add/Edit Alert is a safe-area-aware router screen with native back gestures and a keyboard-safe action. Mobile push registration, per-rule push delivery, and tenant/vehicle-scoped notification event deep links are implemented in source. Remaining parity and release gaps are listed in `docs/FEATURE_MATRIX.md`.
- Shared live status and confirmed stop-duration handling across API, admin, portal, and mobile; mobile map clustering, animated vehicle positions, and map-first vehicle detail.
- GT06 valid GPS ACK now follows confirmed API persistence with bounded retry; admin/mobile polling reject stale overlapping results. Production gateway behavior still needs Oracle deployment and timestamp/log verification.
- Vehicles, devices, telemetry, alerts, geofences, POIs, speed zones, and driver behavior scoring.
- Reports in admin and portal: 13 report types, vehicle groups, period/conditional filters, CSV/Excel/Print, saved reports.
- Audit logs for internal operations.
- Client portal topbar permission gating through DB-backed role portal permissions.
- SQL migrations present through `025_mobile_push_sound_support.sql`; migration 025 must be applied before deploying the updated API. EAS project ID is configured; Android signing/FCM and iOS APNs credentials, native build, and device delivery QA remain release prerequisites.

## Active constraints

- Every schema change requires a migration.
- API/gateway production changes require build plus PM2 restart after pull.
- Every client-facing feature must be added to portal role permissions and UI guards.
- Preserve react-leaflet v4 and custom marker pointer-event behavior.
- Use raw SQL for PostgreSQL `DISTINCT ON` queries.

## Next product priorities

1. Complete Trackvee mobile parity and release readiness; see `docs/FEATURE_MATRIX.md` for exact gaps.
2. Maintenance reminders and service history.
3. Device health center.
4. Scheduled report delivery.
5. Fuel monitoring and cost analytics.

## Blockers

Mobile foundation is in progress. Android export is verified; native-device interaction, remaining mobile parity, signed EAS builds, and store distribution setup remain.

See `docs/FEATURE_MATRIX.md` for feature parity and `KNOWN_ISSUES.md` for operational/regression constraints.

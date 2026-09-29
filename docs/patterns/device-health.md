# Device Health Center

## Scope and data sources

- The admin Device Health page and client-portal Device Health panel use `GET /telemetry/device-health`.
- The mobile `More > Device Health` screen uses the same endpoint and refreshes only while focused; mobile access is gated by `vehicles.view`.
- The response combines device `last_seen_at` (server receipt), heartbeat fields, and the newest telemetry point. Use telemetry `created_at` for GPS freshness and tracker `timestamp` for device-clock lag; do not treat the tracker clock as server receipt time.
- No database columns are added for computed health states. Keep derived thresholds centralized in the API response.

## Status rules

- Connection: Online through 2 minutes since last server-received packet; Delayed after 2 and through 10 minutes; Offline after 10 minutes; Never connected when no packet exists.
- GPS: stale after 10 minutes since last GPS packet was received; otherwise classify by GPS validity and satellite count (4+ good, fewer weak). Missing telemetry is unknown.
- GSM levels: unknown when absent, weak at 0–1, fair at 2–3, good at 4+.
- Power labels use the existing GT06 voltage-level enum, not volts. External power is shown separately.
- Tracker timestamp lag over 120 seconds is shown as a diagnostic; it must not affect packet persistence or ACK behavior.

## Access and load

- Internal staff access is controlled by the `device-health` page permission. Client access requires effective `vehicles.view` and returns only devices available through the existing organization and per-user vehicle scope.
- Never accept client-supplied organization IDs or IMEI lists as the authorization scope. City filtering is internal-admin-only UI context.
- UI refreshes every 30 seconds with overlapping requests suppressed. Keep health reads as one device list plus one latest-telemetry query scoped to those authorized IMEIs.

## Primary sources

- `apps/api/src/telemetry/telemetry.service.ts`
- `apps/api/src/telemetry/telemetry.controller.ts`
- `apps/admin/src/pages/DeviceHealthPage.tsx`
- `apps/portal/src/components/DeviceHealthPanel.tsx`
- `apps/mobile/app/device-health.tsx`

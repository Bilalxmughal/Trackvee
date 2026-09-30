# Device Inventory, Assignment, and Vehicle Lifecycle

## State model

- `devices.inventory_status` is the stock state: `in_stock`, `assigned`, `maintenance`, or `retired`.
- `devices.status` remains the connection/heartbeat state. A heartbeat must never change inventory status.
- `vehicles.lifecycle_status` is `active`, `expired`, or `archived`; `expires_at` can make an otherwise active vehicle effectively expired.
- Only active, unexpired vehicles appear in `/telemetry/live` and accept tracker commands. Expired and archived vehicles remain available in vehicle lists, reports, history, and assignment timelines.

## Assignment integrity and history

- `device_assignments` is the time-bounded source of truth. At most one current assignment per device and per vehicle is enforced by partial unique indexes.
- Assign, transfer, unassign, and replacement run transactionally; a replacement closes the old device period and opens the new period in the same operation. Do not directly edit `devices.vehicle_id` from CRUD forms.
- All assignment, replacement, and removal operations start from Vehicle details. The Devices page is inventory-only; do not expose assignment or per-device history actions there. A device assigned to another vehicle must produce a conflict naming that vehicle and require removal there before it can be used elsewhere.
- Removing a device from a vehicle closes its assignment and expires that vehicle in the same transaction (`lifecycle_reason = 'device_removed'`). Expired vehicles stay in client portal vehicle lists and reports/history, but `/telemetry/live` must omit them. The portal map left panel still lists them at the bottom as `Expired`, without a marker, live count, or live actions. Assigning an in-stock replacement reactivates only a vehicle expired for `device_removed`; manually expired, archived, and past-expiry vehicles stay unavailable.
- Device inventory summary cards (total, assigned, in stock) are aggregated independently of table search and filters; city scope may apply.
- Keep assignment rows when a device is moved or replaced. Devices or vehicles with telemetry/assignment history must be retired/archived instead of hard-deleted.
- Reports attribute each packet using its tracker timestamp within `[assigned_at, unassigned_at)`. Never map all historical packets to the device currently installed on the vehicle.
- `organization_id` on an assignment is a tenant snapshot. Client assignment history and reports must respect that snapshot when a vehicle has moved between organizations.
- Migration `031_device_assignment_and_vehicle_lifecycle.sql` backfills old assignments from the earliest retained telemetry timestamp, falling back to device creation time. This is an estimate for legacy installation dates; exact dates are reliable only for assignments recorded after the migration.

## Inventory filters and privacy

- Internal inventory supports device/plate search, stock/connection state, added-date range, and searchable organization selection. The Vehicles page supports lifecycle counts, searchable client selection, added-date and tracking-expiry ranges, plus searchable device selection in vehicle details. Devices remains inventory-only and has no client-user filter.
- The client-user filter is based on the selected user’s organization and effective per-user vehicle list (`NULL` means all, `[]` means none), not on the vehicle creator field.
- Do not display the vehicle's `owner_id` as “Vehicle Owner”; it can identify the user who originally created the vehicle and is not a reliable current assignment owner. The client-user filter still uses that user's effective vehicle permissions. Cast incoming city, organization, and client-user IDs to UUID in SQL predicates.
- Display date-only values in this feature as `DD-Mon-YYYY` (for example, `01-Jan-2026`). Include the same date format before the time in assignment history.
- Admin may view full IMEI and SIM. Client/mobile must never render or search IMEI; assignment history omits it and masks SIM to the last four digits.
- Client history requires effective `vehicles.view`, organization membership, and the user’s vehicle scope. Inventory mutation and lifecycle actions are internal operations.

## Primary sources

- `apps/api/src/devices/devices.service.ts`
- `apps/api/src/vehicles/vehicles.service.ts`
- `apps/api/src/reports/reports.service.ts`
- `apps/admin/src/pages/DevicesPage.tsx`
- `apps/admin/src/pages/VehiclesPage.tsx`
- `apps/portal/src/pages/VehiclesPage.tsx`
- Migration `032_vehicle_device_lifecycle_reason.sql` distinguishes removal-triggered expiry from manual lifecycle changes.

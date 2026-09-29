# Maintenance and Service History

## Product behavior

- Users log a service against one vehicle with service type/date, optional entered odometer, provider, cost, notes, and next due date/odometer.
- A vehicle/service-type pair has one active reminder: the newest service record by service date and creation time. Older records remain in history and display as completed.
- Reminder state is `scheduled`, `upcoming`, or `overdue`; due thresholds use the record's lead-time settings (defaults: 30 days and 500 km).
- Date reminders use the service's entered next-due date. Distance reminders require an entered service odometer; current distance is that baseline plus GPS-derived distance since service and must be labeled Estimated. It is not a tracker odometer reading.
- The current implementation surfaces upcoming/overdue states in the Maintenance list. It does not send scheduled push notifications.
- Service logging uses grouped organization vehicle options. Standard types are Engine Oil, Tuning, Oil Filter, Air Filter, AC Filter, Fuel Filter, Brake Pads, Brake Fluid, Coolant, Transmission Oil, Battery, Tyre Rotation, General Inspection, and Other; Other stores a required custom type.
- Service and due dates display as `DD-MM-YYYY`; API payloads remain strict `YYYY-MM-DD`.
- Maintenance alert rules select a service type and fire once per latest matching service record when its configured date or estimated-distance reminder window starts or becomes overdue. Evaluation runs on the vehicle's next valid telemetry packet; push follows the alert's mobile push and sound settings. A newly logged matching service creates a new reminder cycle.

## Access and tenant safety

- Feature key: `maintenance`; actions: view/add/edit/delete.
- Wire role defaults, admin Role Access, portal topbar gating, mobile More gating, per-user OrgPerm fields, and API enforcement together.
- Client organization comes from the authenticated user. Validate vehicle ownership and per-user vehicle scope for every record operation; never trust a submitted tenant ID from a client role.
- Internal staff select an organization in Admin; API still validates the target vehicle belongs to it.

## Storage and deployment

- PostgreSQL table: `maintenance_records`; entity: `MaintenanceRecord`. A composite foreign key ties each record's organization and vehicle together at database level.
- Migration `029_maintenance_records.sql` creates the table/index and nullable custom permission fields, and inserts default role actions. Apply it before deploying the API.
- Date form defaults use Asia/Karachi calendar date. API validates strict real `YYYY-MM-DD` dates.

## Primary sources

- `apps/api/src/maintenance/`
- `apps/api/migrations/029_maintenance_records.sql`
- `apps/admin/src/pages/MaintenancePage.tsx`
- `apps/portal/src/components/MaintenancePanel.tsx`
- `apps/mobile/app/maintenance.tsx`

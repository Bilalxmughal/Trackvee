# Feature Matrix

Last verified: 2026-09-30 (API typecheck passes. Admin/portal checks report the repository's existing React 18/19 JSX type conflicts.)

| Feature | API | Admin | Portal | Permission key | Notes |
|---|---|---|---|---|---|
| Authentication | Complete | Complete | Complete | n/a | Admin/client role login separation |
| Live map and history | Complete | Complete | Complete | `map` | Portal map is the background workspace |
| Vehicles and groups | Complete | Complete | Map panel/groups | `vehicles` | Plate first; display name is Make/Model |
| Devices and telemetry | Complete | Complete | Complete | `vehicles.view` (client/mobile) | Devices is inventory-only with total/assigned/in-stock counts. Internal assign/replace/remove and assignment history are managed from Vehicle details. Removing a device expires the vehicle; it remains in client vehicle lists/history/reports and appears as an `Expired` row in the portal map panel, while map markers and live status counts exclude it. Admin Vehicles has lifecycle counts, searchable client/device selection, expiry column/filter, and named actions. Cross-vehicle assignment is rejected; intentional unassignment is allowed and expires the former vehicle. Client UI never displays IMEI. Migrations 031–033 required. |
| Alerts | Complete | Complete | Complete | `alerts` | Rules, schedules, notifications, vehicle targeting, mobile push and shared sounds |
| Notification sound catalogue | Complete | Complete | Read active choices | `alerts` | Internal upload/activation; client selection; dynamic mobile install requires EAS release |
| Geofences | Complete | Complete | Complete | `geofences` | Circle and polygon drawing; mobile CRUD is tenant- and permission-scoped |
| POIs | Complete | Complete | Complete | `pois` | Shared icons and map picking; mobile CRUD is tenant- and permission-scoped |
| Speed zones | Complete | Complete | Map integration | related alert access | Migration 018 |
| Driver behavior | Complete | Complete | Complete | `driver-behavior` | Mobile trend, leaderboard, detail/events/chart and role-gated settings; API enforces tenant and vehicle scope |
| Reports | Complete | Complete | Complete | `reports` | 13 types, grouped vehicles, filters, exports and saved reports |
| Users/custom access | Complete | Complete | Complete | `users` | Per-user permissions cover 10 portal areas with supported CRUD; Admin shows a permission action and granted-page count. B2C role defaults have a separate configurable profile; every new client-facing feature must be wired for B2B and B2C. Migration 033 adds Dashboard/Map overrides. |
| Audit logs | Complete | Complete | Not exposed | `audit-logs` | Internal operational feature |
| Tracking expiry | Complete | Complete | Map badge | organization access | Migration 021 |
| Maintenance | Complete | Complete | Complete | `maintenance` | Grouped vehicle selection, standard/custom service types, PKT DD-MM-YYYY dates, due-date/estimated-distance reminders, and service-type alert rules. Alerts evaluate on the vehicle's next valid telemetry packet; apply migration 029 before API deployment. |
| Fuel monitoring | Missing | Missing | Missing | future `fuel` | Planned |
| Scheduled report delivery | Complete (production config pending) | Complete | Complete | `reports:view` | Reusable templates with saved filters, daily PKT time window/rolling periods, owner copy plus up to 10 additional emails, Active/Pause/Edit/Delete; migration 030 and Resend sender/key required |
| Mobile app | Client API | n/a | n/a | role + custom org permissions | Expo 57: client auth, Map/Vehicles/Alerts/Reports/More, grouped vehicle controls, map/detail/history/replay, alert rules, Geofences/POIs, Driver Behavior, Maintenance, all 13 report types with admin-equivalent filters, saved filters and CSV sharing, More > Users with custom module/vehicle grants, and More > Device Health. More > Notifications & refresh manages this-device push, global sound preference, and optional fleet refresh on resume; polling pauses while backgrounded. Push sound preferences need migration 028; sound library needs migrations 025/026 and an EAS release; Users overrides need migration 027. Remaining: physical-device push and health scope QA. |

Mobile Users is permission-gated in the UI and API. User CRUD and grants are organization-scoped, restricted by role hierarchy and the caller's module/vehicle access. Migration `027_extended_user_permissions.sql` adds nullable per-user Driver Behavior, Reports and Users overrides; apply it before deploying the API.

Update this matrix when feature availability, permission wiring, or deployment scope changes. Keep implementation details in domain pattern documents.

# Feature Matrix

Last verified: 2026-09-28 (API build and authorization tests, portal production build, mobile typecheck and Android Expo export; physical-device behavior remains unverified).

| Feature | API | Admin | Portal | Permission key | Notes |
|---|---|---|---|---|---|
| Authentication | Complete | Complete | Complete | n/a | Admin/client role login separation |
| Live map and history | Complete | Complete | Complete | `map` | Portal map is the background workspace |
| Vehicles and groups | Complete | Complete | Map panel/groups | `vehicles` | Plate first; display name is Make/Model |
| Devices and telemetry | Complete | Complete | Map-derived | admin-only pages | Device health workflow pending |
| Alerts | Complete | Complete | Complete | `alerts` | Rules, schedules, notifications, vehicle targeting, mobile push and shared sounds |
| Notification sound catalogue | Complete | Complete | Read active choices | `alerts` | Internal upload/activation; client selection; dynamic mobile install requires EAS release |
| Geofences | Complete | Complete | Complete | `geofences` | Circle and polygon drawing; mobile CRUD is tenant- and permission-scoped |
| POIs | Complete | Complete | Complete | `pois` | Shared icons and map picking; mobile CRUD is tenant- and permission-scoped |
| Speed zones | Complete | Complete | Map integration | related alert access | Migration 018 |
| Driver behavior | Complete | Complete | Complete | `driver-behavior` | Mobile trend, leaderboard, detail/events/chart and role-gated settings; API enforces tenant and vehicle scope |
| Reports | Complete | Complete | Complete | `reports` | 13 types, grouped vehicles, filters, exports and saved reports |
| Users/custom access | Complete | Complete | Complete | `users` | Module and vehicle permissions |
| Audit logs | Complete | Complete | Not exposed | `audit-logs` | Internal operational feature |
| Tracking expiry | Complete | Complete | Map badge | organization access | Migration 021 |
| Maintenance | Missing | Missing | Missing | future `maintenance` | Planned |
| Fuel monitoring | Missing | Missing | Missing | future `fuel` | Planned |
| Scheduled report delivery | Partial | Missing | Missing | `reports` | Saved reports exist; scheduler pending |
| Device health center | Partial data | Missing | Missing | future key | Telemetry data exists; workflow pending |
| Mobile app | Client API | n/a | n/a | role + custom org permissions | Expo 57: client auth, Map/Vehicles/Alerts/Reports/More, grouped vehicle controls, map/detail/history/replay, alert rules, Geofences/POIs, Driver Behavior, all 13 report types with admin-equivalent filters, saved filters and CSV sharing, and More > Users with custom module/vehicle grants. Push sounds need migrations 025/026 and an EAS native-module release; Users overrides need migration 027. Gaps: notification preferences/background refresh, device health and maintenance; physical-device push QA. |

Mobile Users is permission-gated in the UI and API. User CRUD and grants are organization-scoped, restricted by role hierarchy and the caller's module/vehicle access. Migration `027_extended_user_permissions.sql` adds nullable per-user Driver Behavior, Reports and Users overrides; apply it before deploying the API.

Update this matrix when feature availability, permission wiring, or deployment scope changes. Keep implementation details in domain pattern documents.

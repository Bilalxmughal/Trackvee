# Feature Matrix

Last verified: 2026-09-28 (API/mobile typechecks, API build/tests, Android Expo export; native device interaction pending).

| Feature | API | Admin | Portal | Permission key | Notes |
|---|---|---|---|---|---|
| Authentication | Complete | Complete | Complete | n/a | Admin/client role login separation |
| Live map and history | Complete | Complete | Complete | `map` | Portal map is the background workspace |
| Vehicles and groups | Complete | Complete | Map panel/groups | `vehicles` | Plate first; display name is Make/Model |
| Devices and telemetry | Complete | Complete | Map-derived | admin-only pages | Device health workflow pending |
| Alerts | Complete | Complete | Complete | `alerts` | Rules, schedules, notifications, vehicle targeting; mobile push delivery with Trackvee custom chime |
| Geofences | Complete | Complete | Complete | `geofences` | Circle and polygon drawing; mobile CRUD is permission-gated and organization-scoped |
| POIs | Complete | Complete | Complete | `pois` | Shared icons and map picking; mobile CRUD is permission-gated and organization-scoped |
| Speed zones | Complete | Complete | Map integration | related alert access | Migration 018 |
| Driver behavior | Complete | Complete | Complete | `driver-behavior` | Admin/portal parity; mobile More entry, compact 30-day fleet trend above leaderboard, vehicle detail/events/chart and role-gated organization settings. Client API requests enforce tenant and custom vehicle access. |
| Reports | Complete | Complete | Complete | `reports` | 13 types, grouped vehicles, exports, saved reports |
| Users/custom access | Complete | Complete | Complete | `users` | Module and vehicle permissions |
| Audit logs | Complete | Complete | Not exposed | `audit-logs` | Internal operational feature |
| Tracking expiry | Complete | Complete | Map badge | organization access | Migration 021 |
| Maintenance | Missing | Missing | Missing | future `maintenance` | Planned |
| Fuel monitoring | Missing | Missing | Missing | future `fuel` | Planned |
| Scheduled report delivery | Partial | Missing | Missing | `reports` | Saved reports exist; scheduler pending |
| Device health center | Partial data | Missing | Missing | future key | Telemetry data exists; workflow pending |
| Mobile app | Existing API + vehicle-scoped alerts and groups | n/a | Client app | role portal + custom org permissions | Expo 57: client auth, permission-aware Map/Vehicles/Alerts/Reports/More tabs; searchable/status-filtered Vehicles list with grouped vehicles, permission-guarded group create/edit/delete, and Follow/Replay/History/Alert/Engine actions; live map, vehicle detail, vehicle-scoped alert CRUD, PKT History/Replay, Geofence circle/polygon CRUD and POI CRUD with map picking, POI groups/icons, role/custom permission checks, Driver Behavior leaderboard/detail/chart/settings, 13 report types, grouped vehicle selection and report preview; opt-in Expo push with tenant/vehicle-scoped alert event links (migration 024 and EAS credentials/build required). Gaps: Users/custom-permission management UI; push preferences/background refresh; fleet-wide alert-rule CRUD in Alerts tab; report custom date/time and conditional filters/grouping/exports; device health and maintenance. Native device QA and signed EAS/store release also pending. |

Update this matrix when feature availability, permission wiring, or deployment scope changes. Keep implementation details in domain pattern documents.

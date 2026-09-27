# Feature Matrix

Last verified: 2026-09-27 (Expo SDK 57.0.25 typecheck and Android export pass).

| Feature | API | Admin | Portal | Permission key | Notes |
|---|---|---|---|---|---|
| Authentication | Complete | Complete | Complete | n/a | Admin/client role login separation |
| Live map and history | Complete | Complete | Complete | `map` | Portal map is the background workspace |
| Vehicles and groups | Complete | Complete | Map panel/groups | `vehicles` | Plate first; display name is Make/Model |
| Devices and telemetry | Complete | Complete | Map-derived | admin-only pages | Device health workflow pending |
| Alerts | Complete | Complete | Complete | `alerts` | Rules, schedules, notifications, vehicle targeting |
| Geofences | Complete | Complete | Complete | `geofences` | Circle and polygon drawing |
| POIs | Complete | Complete | Complete | `pois` | Shared icons and map picking |
| Speed zones | Complete | Complete | Map integration | related alert access | Migration 018 |
| Driver behavior | Complete | Complete | Complete | `driver-behavior` | Leaderboard, detail, chart, settings |
| Reports | Complete | Complete | Complete | `reports` | 13 types, grouped vehicles, exports, saved reports |
| Users/custom access | Complete | Complete | Complete | `users` | Module and vehicle permissions |
| Audit logs | Complete | Complete | Not exposed | `audit-logs` | Internal operational feature |
| Tracking expiry | Complete | Complete | Map badge | organization access | Migration 021 |
| Maintenance | Missing | Missing | Missing | future `maintenance` | Planned |
| Fuel monitoring | Missing | Missing | Missing | future `fuel` | Planned |
| Scheduled report delivery | Partial | Missing | Missing | `reports` | Saved reports exist; scheduler pending |
| Device health center | Partial data | Missing | Missing | future key | Telemetry data exists; workflow pending |
| Mobile app | Existing API | n/a | Foundation | role portal permissions | Expo 57 auth, live OSM map, vehicle list/detail, alerts, report generation; remaining native parity tracked in mobile pattern |

Update this matrix when feature availability, permission wiring, or deployment scope changes. Keep implementation details in domain pattern documents.

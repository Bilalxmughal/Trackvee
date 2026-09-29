# Context Map

Use this router after reading `AGENTS.md` and `CURRENT_STATE.md`. Load only the row relevant to the task.

| Task area | Read | Primary code locations |
|---|---|---|
| Map, live tracking, history, trip replay, vehicle menu | `docs/patterns/map.md` | admin and portal `MapPage.tsx` |
| Reports and exports | `docs/patterns/reports.md` | API `reports/`, admin `ReportsPage.tsx`, portal `ReportsModal.tsx` |
| Users, roles, portal permissions | `docs/patterns/users-permissions.md` | admin `roles.ts`/`RoleAccessPage.tsx`, portal permission context/users modal |
| Alerts, geofences, POIs, speed zones | `docs/patterns/alerts-geofences-pois.md` | corresponding API modules and admin/portal panels |
| Driver behavior | `docs/patterns/driver-behavior.md` | API module and admin/portal behavior components |
| Maintenance and service history | `docs/patterns/maintenance.md` | API `maintenance/`, admin `MaintenancePage.tsx`, portal `MaintenancePanel.tsx`, mobile `maintenance.tsx` |
| Device health and diagnostics | `docs/patterns/device-health.md` | API `telemetry/`, admin `DeviceHealthPage.tsx`, portal `DeviceHealthPanel.tsx` |
| Mobile app, Expo, navigation, mobile UI | `docs/patterns/mobile.md` | future `apps/mobile`, existing API and portal behavior |
| Shared UI, forms, modals, dates, selection controls | `docs/patterns/ui.md` | closest existing admin and portal components |
| Deployment or production state | `docs/DEPLOYMENT.md`, relevant `KNOWN_ISSUES.md` | workspace scripts, PM2, Vercel settings |
| Architecture, tenancy, security, device protocol | `PROJECT.md`, relevant `DECISIONS.md` | API, gateway, migrations |
| Feature existence or parity audit | `docs/FEATURE_MATRIX.md` | then inspect listed source files |

## Loading rules

- Search before reading a large source file: use symbols, routes, endpoint names, and component names.
- Do not read the complete `CHANGELOG.md` unless investigating when or why behavior changed.
- Do not read every pattern document for a single-domain task.
- Source code wins when documentation and implementation disagree; correct the stale document in the same task.

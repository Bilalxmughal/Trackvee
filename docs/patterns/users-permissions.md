# Users and Permissions Pattern

## Authentication separation

- Portal accepts only `client_owner`, `client_super_admin`, `client_admin`, `client_user`.
- Admin accepts only internal staff roles.
- Wrong-role login and normal authentication failure both show `Invalid email or password`.
- A stored token for the wrong surface is cleared silently.

## Portal user form

Tabs: Profile, Vehicles, Permissions.

- Profile: Role, First/Last Name, Email, Password with visibility control, Active/Inactive.
- Vehicles: all/specific selection, group-aware vehicle list, plate display.
- Permissions: modules limited to what the editing user can grant; View/Add/Edit/Delete table; enabling write automatically enables View.
- The logged-in user cannot change their own role or delete themselves.
- Fixed owner access is not editable.

Per-user access uses `GET /org-permissions/:userId` and `PUT /org-permissions/:userId`; vehicle IDs are stored in the same permission record.

## Mobile organization users

- The More > Users screen is available only with effective `users.view`; create, edit, and delete actions require their matching `users` action.
- User management is limited to the caller's organization and strictly lower roles. A user can update their own profile but cannot change their own role, permissions, active state, or delete themselves. `client_owner` is fixed and cannot be managed.
- The editor has Profile, Vehicles, and Permissions sections. Vehicle choices come from `/users/vehicle-access-options`, are limited to the caller's vehicle scope, and retain searchable, collapsible group selection. `vehicleIds: null` means all organization vehicles; `[]` means none.
- Permission templates are bounded by the caller's own effective grants. Custom module actions are enforced by the API as well as the UI; granting Add/Edit/Delete also grants View. Users, Reports, and Driver Behavior overrides inherit role defaults when their per-user columns are `NULL`.
- `/users/org-users`, `/users/vehicle-access-options`, user CRUD, and `/org-permissions/:userId` derive organization scope from the authenticated client. Never trust a submitted organization ID or allow grants outside the caller's vehicle/action scope.
- Migration `027_extended_user_permissions.sql` adds nullable per-user Driver Behavior, Reports, and Users grants and backfills missing Reports:view role defaults. Apply it before deploying the updated API.

## Role-level portal gating

Flow: admin role configuration -> `role_portal_permissions` -> portal permission context -> `canDo(feature, action)` -> UI visibility/action guard.

Topbar feature mapping:

- alerts -> `alerts`
- geofences -> `geofences`
- pois -> `pois`
- behavior -> `driver-behavior`
- reports -> `reports`
- users -> `users`

Every new client-facing feature must update definitions/defaults, role access UI, portal navigation/action guards, and backend enforcement where required.

## Primary sources

- `apps/admin/src/config/roles.ts`
- `apps/admin/src/pages/RoleAccessPage.tsx`
- `apps/portal/src/contexts/PortalPermsContext.tsx`
- `apps/portal/src/components/UsersModal.tsx`
- `apps/mobile/app/users.tsx`
- `apps/api/src/users/users.controller.ts`
- `apps/api/src/org-permissions/client-feature-access.ts`

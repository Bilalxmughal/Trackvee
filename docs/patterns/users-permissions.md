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

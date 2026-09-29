import { ForbiddenException } from '@nestjs/common';
import { User } from '../users/entities/user.entity.js';
import { OrgPermissionsService, OrgPermDto } from './org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';

export const INTERNAL_ROLES = new Set(['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer']);
export const CLIENT_ROLES = new Set(['client_owner', 'client_super_admin', 'client_admin', 'client_user']);

const FULL = ['view', 'add', 'edit', 'delete'];
const CLIENT_DEFAULTS: Record<string, Record<string, string[]>> = {
  client_owner: {
    dashboard: ['view'], map: ['view'], vehicles: FULL, alerts: FULL, geofences: FULL, pois: FULL,
    'driver-behavior': ['view', 'edit'], reports: ['view'], users: FULL, 'vehicle-groups': ['view', 'edit'], maintenance: FULL,
  },
  client_super_admin: {
    dashboard: ['view'], map: ['view'], vehicles: FULL, alerts: FULL, geofences: FULL, pois: FULL,
    'driver-behavior': ['view', 'edit'], reports: ['view'], users: ['view', 'add', 'edit'], 'vehicle-groups': ['view', 'edit'], maintenance: FULL,
  },
  client_admin: {
    dashboard: ['view'], map: ['view'], vehicles: ['view'], alerts: ['view'], geofences: ['view'], pois: ['view'],
    'driver-behavior': ['view', 'edit'], reports: ['view'], users: ['view', 'add', 'edit'], 'vehicle-groups': ['view'], maintenance: ['view', 'add', 'edit'],
  },
  client_user: {
    dashboard: ['view'], map: ['view'], vehicles: ['view'], alerts: ['view'],
    'driver-behavior': ['view'], reports: ['view'], 'vehicle-groups': ['view'], maintenance: ['view'],
  },
};

const ORG_PERMISSION_PREFIX: Record<string, string> = {
  vehicles: 'vehicles', alerts: 'alerts', geofences: 'geofences', pois: 'pois',
  'driver-behavior': 'driverBehavior', reports: 'reports', users: 'users', maintenance: 'maintenance',
};

export async function effectiveClientActions(
  user: User,
  feature: string,
  orgPermissions: OrgPermissionsService,
  rolePermissions: RolePortalPermissionsService,
): Promise<string[]> {
  if (!CLIENT_ROLES.has(user.role) || !user.organizationId) return [];
  const [roleMap, permission] = await Promise.all([
    rolePermissions.findAll(),
    orgPermissions.findByUser(user.id),
  ]);
  if (permission && permission.orgId !== user.organizationId) throw new ForbiddenException();

  // Missing role keys inherit product defaults; an explicit empty action list remains a denial.
  const roleActions = roleMap[user.role]?.[feature] ?? CLIENT_DEFAULTS[user.role]?.[feature] ?? [];
  if (user.role === 'client_owner') return roleActions;
  const prefix = ORG_PERMISSION_PREFIX[feature];
  if (!prefix || !permission) return roleActions;

  const candidates = feature === 'reports' ? ['view']
    : feature === 'driver-behavior' ? ['view', 'edit']
    : ['view', 'add', 'edit', 'delete'];
  return candidates.filter(action => {
    const field = `${prefix}${action[0]!.toUpperCase()}${action.slice(1)}`;
    const override = (permission as unknown as Record<string, unknown>)[field];
    return typeof override === 'boolean' ? override : roleActions.includes(action);
  });
}

export async function assertClientFeatureAccess(
  user: User,
  feature: string,
  action: string,
  orgPermissions: OrgPermissionsService,
  rolePermissions: RolePortalPermissionsService,
): Promise<void> {
  if (INTERNAL_ROLES.has(user.role)) return;
  if (!CLIENT_ROLES.has(user.role) || !user.organizationId) throw new ForbiddenException('Organization access required');
  const actions = await effectiveClientActions(user, feature, orgPermissions, rolePermissions);
  if (!actions.includes(action)) throw new ForbiddenException(`${feature} ${action} permission required`);
}

const ROLE_LEVEL: Record<string, number> = {
  client_owner: 4, client_super_admin: 3, client_admin: 2, client_user: 1,
};
const PERMISSION_FEATURE: Record<string, { feature: string; action: string }> = {
  vehiclesView: { feature: 'vehicles', action: 'view' }, vehiclesAdd: { feature: 'vehicles', action: 'add' },
  vehiclesEdit: { feature: 'vehicles', action: 'edit' }, vehiclesDelete: { feature: 'vehicles', action: 'delete' },
  alertsView: { feature: 'alerts', action: 'view' }, alertsAdd: { feature: 'alerts', action: 'add' },
  alertsEdit: { feature: 'alerts', action: 'edit' }, alertsDelete: { feature: 'alerts', action: 'delete' },
  geofencesView: { feature: 'geofences', action: 'view' }, geofencesAdd: { feature: 'geofences', action: 'add' },
  geofencesEdit: { feature: 'geofences', action: 'edit' }, geofencesDelete: { feature: 'geofences', action: 'delete' },
  poisView: { feature: 'pois', action: 'view' }, poisAdd: { feature: 'pois', action: 'add' },
  poisEdit: { feature: 'pois', action: 'edit' }, poisDelete: { feature: 'pois', action: 'delete' },
  driverBehaviorView: { feature: 'driver-behavior', action: 'view' }, driverBehaviorEdit: { feature: 'driver-behavior', action: 'edit' },
  reportsView: { feature: 'reports', action: 'view' },
  usersView: { feature: 'users', action: 'view' }, usersAdd: { feature: 'users', action: 'add' },
  usersEdit: { feature: 'users', action: 'edit' }, usersDelete: { feature: 'users', action: 'delete' },
  maintenanceView: { feature: 'maintenance', action: 'view' }, maintenanceAdd: { feature: 'maintenance', action: 'add' },
  maintenanceEdit: { feature: 'maintenance', action: 'edit' }, maintenanceDelete: { feature: 'maintenance', action: 'delete' },
};

export async function validateOrgPermissionGrant(
  caller: User,
  target: User,
  dto: OrgPermDto,
  requiredAction: 'add' | 'edit',
  orgPermissions: OrgPermissionsService,
  rolePermissions: RolePortalPermissionsService,
  findOrgVehicleIds: (ids: string[]) => Promise<string[]>,
): Promise<void> {
  if (!caller.organizationId || caller.organizationId !== target.organizationId || caller.id === target.id) throw new ForbiddenException();
  const callerLevel = ROLE_LEVEL[caller.role] ?? 0;
  const targetLevel = ROLE_LEVEL[target.role] ?? 0;
  if (!targetLevel || target.role === 'client_owner' || targetLevel >= callerLevel) throw new ForbiddenException('You cannot manage this user');
  await assertClientFeatureAccess(caller, 'users', requiredAction, orgPermissions, rolePermissions);

  // Write access always carries its corresponding view permission, matching the portal editor.
  const mutable = dto as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(dto)) {
    if (!key.endsWith('Add') && !key.endsWith('Edit') && !key.endsWith('Delete')) continue;
    if (value !== true) continue;
    const viewKey = `${key.replace(/Add$|Edit$|Delete$/, '')}View`;
    mutable[viewKey] = true;
  }

  const grants = Object.entries(dto).filter(([key, value]) => PERMISSION_FEATURE[key] && value === true);
  const implicitViews = new Set(Object.entries(dto)
    .filter(([key, value]) => value === true && /(?:Add|Edit|Delete)$/.test(key))
    .map(([key]) => `${key.replace(/(?:Add|Edit|Delete)$/, '')}View`));
  const ownActions = new Map<string, string[]>();
  for (const [key] of grants) {
    if (implicitViews.has(key)) continue;
    const targetPerm = PERMISSION_FEATURE[key]!;
    let actions = ownActions.get(targetPerm.feature);
    if (!actions) {
      actions = await effectiveClientActions(caller, targetPerm.feature, orgPermissions, rolePermissions);
      ownActions.set(targetPerm.feature, actions);
    }
    if (!actions.includes(targetPerm.action)) throw new ForbiddenException(`You cannot grant ${targetPerm.feature} ${targetPerm.action}`);
  }

  if (dto.vehicleIds !== undefined) {
    const ownPermission = await orgPermissions.findByUser(caller.id);
    if (ownPermission && ownPermission.orgId !== caller.organizationId) throw new ForbiddenException();
    const ownVehicleIds = ownPermission?.vehicleIds ?? null;
    if (dto.vehicleIds === null && ownVehicleIds !== null) throw new ForbiddenException('You cannot grant access to all vehicles');
    if (Array.isArray(dto.vehicleIds)) {
      const requested = [...new Set(dto.vehicleIds)];
      const validIds = await findOrgVehicleIds(requested);
      if (validIds.length !== requested.length) throw new ForbiddenException('Vehicle access must stay within your organization');
      if (ownVehicleIds !== null && requested.some(id => !ownVehicleIds.includes(id))) throw new ForbiddenException('You cannot grant vehicles outside your access');
      dto.vehicleIds = requested;
    }
  }
}

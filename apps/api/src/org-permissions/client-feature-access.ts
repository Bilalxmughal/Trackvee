import { ForbiddenException } from '@nestjs/common';
import { User } from '../users/entities/user.entity.js';
import { OrgPermissionsService } from './org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';

const INTERNAL_ROLES = new Set(['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer']);
const CLIENT_DEFAULTS: Record<string, Record<string, string[]>> = {
  client_owner: { geofences: ['view', 'add', 'edit', 'delete'], pois: ['view', 'add', 'edit', 'delete'] },
  client_super_admin: { geofences: ['view', 'add', 'edit', 'delete'], pois: ['view', 'add', 'edit', 'delete'] },
  client_admin: { geofences: ['view'], pois: ['view'] },
  client_user: {},
};

export async function assertClientFeatureAccess(
  user: User,
  feature: 'geofences' | 'pois',
  action: 'view' | 'add' | 'edit' | 'delete',
  orgPermissions: OrgPermissionsService,
  rolePermissions: RolePortalPermissionsService,
): Promise<void> {
  if (INTERNAL_ROLES.has(user.role)) return;
  if (!user.organizationId) throw new ForbiddenException('Organization access required');

  const orgPermission = await orgPermissions.findByUser(user.id);
  if (orgPermission && orgPermission.orgId !== user.organizationId) throw new ForbiddenException();

  const roleMap = await rolePermissions.findAll();
  const actions = roleMap[user.role]?.[feature] ?? CLIENT_DEFAULTS[user.role]?.[feature] ?? [];
  const field = `${feature}${action[0]!.toUpperCase()}${action.slice(1)}`;
  const override = orgPermission ? (orgPermission as unknown as Record<string, unknown>)[field] : undefined;
  const allowed = typeof override === 'boolean' ? override : actions.includes(action);
  if (!allowed) throw new ForbiddenException(`${feature} ${action} permission required`);
}

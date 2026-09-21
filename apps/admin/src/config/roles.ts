import type { UserRole } from '@yotrack/types';

export type PageAction = 'view' | 'add' | 'edit' | 'delete';

export const ROLE_LABEL: Record<string, string> = {
  super_admin:  'Super Admin',
  admin:        'Admin',
  ops:          'Ops',
  live_ops:     'Live Ops',
  agent:        'Agent',
  chat_support: 'Chat Support',
  viewer:       'Viewer',
  org_owner:    'Org Owner',
  org_admin:    'Org Admin',
  org_user:     'Org User',
  customer:     'Customer',
};

// Page-level CRUD permissions per internal role
export const ROLE_PERMISSIONS: Partial<Record<UserRole, Partial<Record<string, PageAction[]>>>> = {
  super_admin: {
    dashboard: ['view'],
    map:       ['view'],
    clients:   ['view', 'add', 'edit', 'delete'],
    vehicles:  ['view', 'add', 'edit', 'delete'],
    devices:   ['view', 'add', 'edit', 'delete'],
    telemetry: ['view'],
    users:     ['view', 'add', 'edit', 'delete'],
    roles:     ['view'],
    settings:  ['view', 'edit'],
    setup:     ['view'],
  },
  admin: {
    dashboard: ['view'],
    map:       ['view'],
    clients:   ['view', 'add', 'edit', 'delete'],
    vehicles:  ['view', 'add', 'edit', 'delete'],
    devices:   ['view', 'add', 'edit', 'delete'],
    telemetry: ['view'],
    users:     ['view', 'add', 'edit', 'delete'],
    roles:     ['view'],
    settings:  ['view', 'edit'],
    setup:     ['view'],
  },
  ops: {
    dashboard: ['view'],
    map:       ['view'],
    clients:   ['view', 'add', 'edit'],
    vehicles:  ['view', 'add', 'edit'],
    devices:   ['view', 'add', 'edit'],
    telemetry: ['view'],
    setup:     ['view'],
  },
  live_ops: {
    dashboard: ['view'],
    map:       ['view'],
    telemetry: ['view'],
  },
  agent: {
    dashboard: ['view'],
    map:       ['view'],
    clients:   ['view'],
  },
  chat_support: {
    dashboard: ['view'],
    clients:   ['view'],
  },
  viewer: {
    dashboard: ['view'],
    map:       ['view'],
    clients:   ['view'],
    vehicles:  ['view'],
    devices:   ['view'],
    setup:     ['view'],
  },
};

// Topbar feature CRUD permissions per internal role
export const TOPBAR_PERMISSIONS: Partial<Record<UserRole, Partial<Record<string, PageAction[]>>>> = {
  super_admin: {
    alerts:    ['view', 'add', 'edit', 'delete'],
    geofences: ['view', 'add', 'edit', 'delete'],
    pois:      ['view', 'add', 'edit', 'delete'],
  },
  admin: {
    alerts:    ['view', 'add', 'edit', 'delete'],
    geofences: ['view', 'add', 'edit', 'delete'],
    pois:      ['view', 'add', 'edit', 'delete'],
  },
  ops: {
    alerts:    ['view', 'add', 'edit', 'delete'],
    geofences: ['view', 'add', 'edit', 'delete'],
    pois:      ['view', 'add', 'edit', 'delete'],
  },
  live_ops: {
    alerts:    ['view', 'add', 'edit'],
    geofences: ['view', 'add', 'edit'],
    pois:      ['view', 'add', 'edit'],
  },
  agent: {
    alerts:    ['view'],
  },
  chat_support: {
    alerts:    ['view'],
  },
  viewer: {
    alerts:    ['view'],
    geofences: ['view'],
    pois:      ['view'],
  },
};

// Derived: which pages each role can access (sidebar filter + route protection)
export const ROLE_PAGES: Partial<Record<UserRole, string[]>> = Object.fromEntries(
  Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => [role, Object.keys(perms ?? {})])
) as Partial<Record<UserRole, string[]>>;

// Derived: which topbar features each role can access
export const ROLE_TOPBAR: Partial<Record<UserRole, string[]>> = Object.fromEntries(
  Object.entries(TOPBAR_PERMISSIONS).map(([role, perms]) => [role, Object.keys(perms ?? {})])
) as Partial<Record<UserRole, string[]>>;

export const INTERNAL_ROLES: UserRole[] = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

export function canAccessPage(role: UserRole, page: string): boolean {
  return !!(ROLE_PERMISSIONS[role]?.[page]);
}

export function canPerformAction(role: UserRole, page: string, action: PageAction): boolean {
  return !!(ROLE_PERMISSIONS[role]?.[page]?.includes(action));
}

export function canAccessTopbar(role: UserRole, feature: string): boolean {
  return !!(TOPBAR_PERMISSIONS[role]?.[feature]);
}

export function canPerformTopbarAction(role: UserRole, feature: string, action: PageAction): boolean {
  return !!(TOPBAR_PERMISSIONS[role]?.[feature]?.includes(action));
}

export function isInternalRole(role: UserRole): boolean {
  return INTERNAL_ROLES.includes(role);
}

// Who can manage whose permissions on RoleAccessPage
export function canManageRole(currentRole: UserRole, targetRole: UserRole): boolean {
  if (currentRole === 'super_admin') return targetRole !== 'super_admin'; // super_admin can edit everyone except itself
  if (currentRole === 'admin') return targetRole !== 'super_admin' && targetRole !== 'admin'; // admin cannot touch super_admin or admin
  return false;
}

import type { UserRole } from '@yotrack/types';

export type PageAction = 'view' | 'add' | 'edit' | 'delete';

export const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  ops: 'Ops',
  live_ops: 'Live Ops',
  agent: 'Agent',
  chat_support: 'Chat Support',
  viewer: 'Viewer',
  org_owner: 'Org Owner',
  org_admin: 'Org Admin',
  org_user: 'Org User',
  customer: 'Customer',
};

// Granular CRUD permissions per internal role per page
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

// Derived: which pages each role can access (for sidebar filtering + route protection)
export const ROLE_PAGES: Partial<Record<UserRole, string[]>> = Object.fromEntries(
  Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => [role, Object.keys(perms ?? {})])
) as Partial<Record<UserRole, string[]>>;

// Topbar features per role
export const ROLE_TOPBAR: Partial<Record<UserRole, string[]>> = {
  super_admin:  ['alerts', 'geofences', 'pois'],
  admin:        ['alerts', 'geofences', 'pois'],
  ops:          ['alerts', 'geofences', 'pois'],
  live_ops:     ['alerts', 'geofences', 'pois'],
  agent:        ['alerts'],
  chat_support: ['alerts'],
  viewer:       ['alerts', 'geofences', 'pois'],
};

export const INTERNAL_ROLES: UserRole[] = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

export function canAccessPage(role: UserRole, page: string): boolean {
  return !!(ROLE_PERMISSIONS[role]?.[page]);
}

export function canPerformAction(role: UserRole, page: string, action: PageAction): boolean {
  return !!(ROLE_PERMISSIONS[role]?.[page]?.includes(action));
}

export function canAccessTopbar(role: UserRole, feature: string): boolean {
  return !!(ROLE_TOPBAR[role]?.includes(feature));
}

export function isInternalRole(role: UserRole): boolean {
  return INTERNAL_ROLES.includes(role);
}

import type { UserRole } from '@yotrack/types';

export type PageAction = 'view' | 'add' | 'edit' | 'delete';

export const ROLE_LABEL: Record<string, string> = {
  super_admin:        'Super Admin',
  admin:              'Admin',
  ops:                'Ops',
  live_ops:           'Live Ops',
  agent:              'Agent',
  chat_support:       'Chat Support',
  viewer:             'Viewer',
  client_owner:       'Client Owner',
  client_super_admin: 'Client Super Admin',
  client_admin:       'Client Admin',
  client_user:        'Client User',
};

// Page-level CRUD permissions per internal role
export const ROLE_PERMISSIONS: Partial<Record<UserRole, Partial<Record<string, PageAction[]>>>> = {
  super_admin: {
    dashboard:         ['view'],
    map:               ['view'],
    clients:           ['view', 'add', 'edit', 'delete'],
    'client-users':    ['view', 'add', 'edit', 'delete'],
    vehicles:          ['view', 'add', 'edit', 'delete'],
    devices:           ['view', 'add', 'edit', 'delete'],
    'device-health':   ['view'],
    telemetry:         ['view'],
    'driver-behavior': ['view', 'edit'],
    maintenance:      ['view', 'add', 'edit', 'delete'],
    users:             ['view', 'add', 'edit', 'delete'],
    roles:             ['view'],
    'audit-logs':      ['view'],
    reports:           ['view'],
    settings:          ['view', 'edit'],
    'notification-sounds': ['view', 'add', 'edit'],
    setup:             ['view'],
  },
  admin: {
    dashboard:         ['view'],
    map:               ['view'],
    clients:           ['view', 'add', 'edit', 'delete'],
    'client-users':    ['view', 'add', 'edit', 'delete'],
    vehicles:          ['view', 'add', 'edit', 'delete'],
    devices:           ['view', 'add', 'edit', 'delete'],
    'device-health':   ['view'],
    telemetry:         ['view'],
    'driver-behavior': ['view', 'edit'],
    maintenance:      ['view', 'add', 'edit', 'delete'],
    users:             ['view', 'add', 'edit', 'delete'],
    roles:             ['view'],
    'audit-logs':      ['view'],
    reports:           ['view'],
    settings:          ['view', 'edit'],
    'notification-sounds': ['view', 'add', 'edit'],
    setup:             ['view'],
  },
  ops: {
    dashboard:         ['view'],
    map:               ['view'],
    clients:           ['view', 'add', 'edit'],
    'client-users':    ['view', 'add', 'edit'],
    vehicles:          ['view', 'add', 'edit'],
    devices:           ['view', 'add', 'edit'],
    'device-health':   ['view'],
    telemetry:         ['view'],
    'driver-behavior': ['view'],
    maintenance:      ['view', 'add', 'edit'],
    'audit-logs':      ['view'],
    reports:           ['view'],
    setup:             ['view'],
    'notification-sounds': ['view', 'add', 'edit'],
  },
  live_ops: {
    dashboard: ['view'],
    map:       ['view'],
    telemetry: ['view'],
    maintenance: ['view'],
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
    maintenance: ['view'],
    devices:   ['view'],
    'device-health': ['view'],
    setup:     ['view'],
  },
  client_owner: {
    dashboard:         ['view'],
    map:               ['view'],
    vehicles:          ['view', 'add', 'edit', 'delete'],
    'client-users':    ['view', 'add', 'edit', 'delete'],
    alerts:            ['view', 'add', 'edit', 'delete'],
    geofences:         ['view', 'add', 'edit', 'delete'],
    pois:              ['view', 'add', 'edit', 'delete'],
    'driver-behavior': ['view', 'edit'],
    maintenance:      ['view', 'add', 'edit', 'delete'],
    'vehicle-groups':  ['view', 'edit'],
    reports:           ['view'],
  },
  client_super_admin: {
    dashboard:         ['view'],
    map:               ['view'],
    vehicles:          ['view', 'add', 'edit', 'delete'],
    'client-users':    ['view', 'add', 'edit', 'delete'],
    alerts:            ['view', 'add', 'edit', 'delete'],
    geofences:         ['view', 'add', 'edit', 'delete'],
    pois:              ['view', 'add', 'edit', 'delete'],
    'driver-behavior': ['view', 'edit'],
    maintenance:      ['view', 'add', 'edit', 'delete'],
    'vehicle-groups':  ['view', 'edit'],
    reports:           ['view'],
  },
  client_admin: {
    dashboard:         ['view'],
    map:               ['view'],
    vehicles:          ['view'],
    alerts:            ['view'],
    geofences:         ['view'],
    pois:              ['view'],
    'driver-behavior': ['view', 'edit'],
    maintenance:      ['view', 'add', 'edit'],
    'vehicle-groups':  ['view', 'edit'],
    reports:           ['view'],
  },
  client_user: {
    dashboard:         ['view'],
    map:               ['view'],
    vehicles:          ['view'],
    alerts:            ['view'],
    'driver-behavior': ['view'],
    maintenance:      ['view'],
    'vehicle-groups':  ['view'],
    reports:           ['view'],
  },
};

// Topbar feature CRUD permissions per internal role
export const TOPBAR_PERMISSIONS: Partial<Record<UserRole, Partial<Record<string, PageAction[]>>>> = {
  super_admin: {
    alerts:            ['view', 'add', 'edit', 'delete'],
    geofences:         ['view', 'add', 'edit', 'delete'],
    pois:              ['view', 'add', 'edit', 'delete'],
    'driver-behavior': ['view', 'edit'],
    maintenance:      ['view', 'add', 'edit', 'delete'],
    engine_cut:        ['view'],
  },
  admin: {
    alerts:            ['view', 'add', 'edit', 'delete'],
    geofences:         ['view', 'add', 'edit', 'delete'],
    pois:              ['view', 'add', 'edit', 'delete'],
    'driver-behavior': ['view', 'edit'],
    maintenance:      ['view', 'add', 'edit', 'delete'],
    engine_cut:        ['view'],
  },
  ops: {
    alerts:            ['view', 'add', 'edit', 'delete'],
    geofences:         ['view', 'add', 'edit', 'delete'],
    pois:              ['view', 'add', 'edit', 'delete'],
    'driver-behavior': ['view', 'edit'],
    maintenance:      ['view', 'add', 'edit'],
    engine_cut:        ['view'],
  },
  live_ops: {
    alerts:            ['view', 'add', 'edit'],
    geofences:         ['view', 'add', 'edit'],
    pois:              ['view', 'add', 'edit'],
    'driver-behavior': ['view'],
    maintenance:      ['view'],
  },
  agent: {
    alerts:    ['view'],
  },
  chat_support: {
    alerts:    ['view'],
  },
  viewer: {
    alerts:            ['view'],
    geofences:         ['view'],
    pois:              ['view'],
    'driver-behavior': ['view'],
  },
  client_owner: {
    alerts:            ['view', 'add', 'edit', 'delete'],
    geofences:         ['view', 'add', 'edit', 'delete'],
    pois:              ['view', 'add', 'edit', 'delete'],
    'driver-behavior': ['view', 'edit'],
    engine_cut:        ['view'],
  },
  client_super_admin: {
    alerts:            ['view', 'add', 'edit', 'delete'],
    geofences:         ['view', 'add', 'edit', 'delete'],
    pois:              ['view', 'add', 'edit', 'delete'],
    'driver-behavior': ['view', 'edit'],
    engine_cut:        ['view'],
  },
  client_admin: {
    alerts:            ['view'],
    geofences:         ['view'],
    pois:              ['view'],
    'driver-behavior': ['view', 'edit'],
  },
  client_user: {
    alerts:            ['view'],
    'driver-behavior': ['view'],
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
export const CLIENT_ROLES: UserRole[] = ['client_owner', 'client_super_admin', 'client_admin', 'client_user'];

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

// Client portal permissions per client role (used in RoleAccessPage client section)
export const ORG_ROLE_PORTAL_PERMISSIONS: Record<string, Partial<Record<string, PageAction[]>>> = {
  client_owner: {
    dashboard:         ['view'],
    map:               ['view'],
    vehicles:          ['view', 'add', 'edit', 'delete'],
    alerts:            ['view', 'add', 'edit', 'delete'],
    geofences:         ['view', 'add', 'edit', 'delete'],
    pois:              ['view', 'add', 'edit', 'delete'],
    'driver-behavior': ['view', 'edit'],
    maintenance:       ['view', 'add', 'edit', 'delete'],
    reports:           ['view'],
    users:             ['view', 'add', 'edit', 'delete'],
  },
  client_super_admin: {
    dashboard:         ['view'],
    map:               ['view'],
    vehicles:          ['view', 'add', 'edit', 'delete'],
    alerts:            ['view', 'add', 'edit', 'delete'],
    geofences:         ['view', 'add', 'edit', 'delete'],
    pois:              ['view', 'add', 'edit', 'delete'],
    'driver-behavior': ['view', 'edit'],
    maintenance:       ['view', 'add', 'edit', 'delete'],
    reports:           ['view'],
    users:             ['view', 'add', 'edit'],
  },
  client_admin: {
    dashboard:         ['view'],
    map:               ['view'],
    vehicles:          ['view'],
    alerts:            ['view'],
    geofences:         ['view'],
    pois:              ['view'],
    'driver-behavior': ['view'],
    maintenance:       ['view', 'add', 'edit'],
    reports:           ['view'],
    users:             ['view', 'add', 'edit'],
  },
  client_user_b2c: {
    dashboard: ['view'], map: ['view'], vehicles: ['view'], alerts: ['view'], geofences: [], pois: [], 'driver-behavior': [], maintenance: [], reports: [], users: [],
  },
  client_user: {
    dashboard:         ['view'],
    map:               ['view'],
    vehicles:          ['view'],
    alerts:            ['view'],
    'driver-behavior': ['view'],
    maintenance:       ['view'],
    reports:           ['view'],
  },
};

export const ORG_ROLES: UserRole[] = ['client_owner', 'client_super_admin', 'client_admin', 'client_user'];

// ── Portal page registry ─────────────────────────────────────────────────────
// Single source of truth for Client Portal page permissions.
// Add a new entry here to make it appear in Role Access matrix AND enforce it.
export interface PortalPageDef {
  key: string;      // DB key stored in role_portal_permissions.permissions JSON
  label: string;    // Display name in Role Access matrix
  group: string;    // Group header in Role Access matrix
  actions: PageAction[];
}

export const ORG_PORTAL_PAGES: PortalPageDef[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'Core',  actions: ['view'] },
  { key: 'map',       label: 'Live Map',  group: 'Core',  actions: ['view'] },
  { key: 'vehicles',  label: 'Vehicles',  group: 'Fleet', actions: ['view', 'add', 'edit', 'delete'] },
];

export const ORG_PORTAL_GROUPS = ['Core', 'Fleet'];

export const ORG_PORTAL_TOPBAR: PortalPageDef[] = [
  { key: 'maintenance',    label: 'Maintenance',    group: 'Topbar', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'alerts',          label: 'Alerts',          group: 'Topbar', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'geofences',       label: 'Geofences',       group: 'Topbar', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'pois',            label: 'POIs',             group: 'Topbar', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'driver-behavior', label: 'Driver Behavior',  group: 'Topbar', actions: ['view', 'edit'] },
  { key: 'reports',         label: 'Reports',          group: 'Topbar', actions: ['view'] },
  { key: 'users',           label: 'Users',            group: 'Topbar', actions: ['view', 'add', 'edit', 'delete'] },
];

// Maps sidebar nav route key → portal feature key (used for sidebar + canOrgDo)
export const ORG_NAV_TO_FEATURE: Record<string, string> = {
  dashboard:         'dashboard',
  map:               'map',
  vehicles:          'vehicles',
  'client-users':    'users',
  'driver-behavior': 'driver-behavior',
  reports:           'reports',
};

export const ORG_ROLE_LABEL: Record<string, string> = {
  client_owner:       'Client Owner',
  client_super_admin: 'Client Super Admin',
  client_admin:       'Client Admin',
  client_user:        'Client User',
};

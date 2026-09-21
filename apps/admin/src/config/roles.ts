import type { UserRole } from '@yotrack/types';

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

// Pages each internal role can access (route paths without leading slash)
export const ROLE_PAGES: Partial<Record<UserRole, string[]>> = {
  super_admin: ['dashboard', 'map', 'clients', 'vehicles', 'devices', 'telemetry', 'users', 'roles', 'settings', 'setup'],
  admin:       ['dashboard', 'map', 'clients', 'vehicles', 'devices', 'telemetry', 'users', 'roles', 'settings', 'setup'],
  ops:         ['dashboard', 'map', 'clients', 'vehicles', 'devices', 'telemetry', 'setup'],
  live_ops:    ['dashboard', 'map', 'telemetry'],
  agent:       ['dashboard', 'map', 'clients'],
  chat_support:['dashboard', 'clients'],
  viewer:      ['dashboard', 'map', 'clients', 'vehicles', 'devices', 'setup'],
};

// Topbar features accessible per role
export const ROLE_TOPBAR: Partial<Record<UserRole, string[]>> = {
  super_admin: ['alerts', 'geofences', 'pois'],
  admin:       ['alerts', 'geofences', 'pois'],
  ops:         ['alerts', 'geofences', 'pois'],
  live_ops:    ['alerts', 'geofences', 'pois'],
  agent:       ['alerts'],
  chat_support:['alerts'],
  viewer:      ['alerts', 'geofences', 'pois'],
};

// Internal Trackvee staff roles (no organizationId — see all data)
export const INTERNAL_ROLES: UserRole[] = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

export function canAccessPage(role: UserRole, page: string): boolean {
  const pages = ROLE_PAGES[role];
  if (!pages) return false;
  return pages.includes(page);
}

export function canAccessTopbar(role: UserRole, feature: string): boolean {
  const features = ROLE_TOPBAR[role];
  if (!features) return false;
  return features.includes(feature);
}

export function isInternalRole(role: UserRole): boolean {
  return INTERNAL_ROLES.includes(role);
}

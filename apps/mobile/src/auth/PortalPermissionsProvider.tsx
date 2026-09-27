import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthProvider';

type RoleMap = Record<string, string[]>;
type OrgPerm = Record<string, boolean | string[] | null>;
const FALLBACK: Record<string, RoleMap> = {
  client_owner: { map: ['view'], vehicles: ['view'], alerts: ['view','add','edit','delete'], geofences: ['view','add','edit','delete'], pois: ['view','add','edit','delete'], 'driver-behavior': ['view','edit'], reports: ['view'], users: ['view','add','edit','delete'], engine_cut: ['view'] },
  client_super_admin: { map: ['view'], vehicles: ['view'], alerts: ['view','add','edit','delete'], geofences: ['view','add','edit','delete'], pois: ['view','add','edit','delete'], 'driver-behavior': ['view','edit'], reports: ['view'], users: ['view','add','edit'], engine_cut: ['view'] },
  client_admin: { map: ['view'], vehicles: ['view'], alerts: ['view'], geofences: ['view'], pois: ['view'], 'driver-behavior': ['view'] },
  client_user: { map: ['view'], vehicles: ['view'], alerts: ['view'], 'driver-behavior': ['view'] },
};
interface PermissionValue { canDo: (feature: string, action?: string) => boolean; loading: boolean; }
const Context = createContext<PermissionValue | null>(null);

export function PortalPermissionsProvider({ children }: React.PropsWithChildren) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<RoleMap>({ map: ['view'] });
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!user) { setPermissions({ map: ['view'] }); setResolvedUserId(null); return; }
    let current = true;
    Promise.allSettled([
      api.get<Record<string, RoleMap>>('/role-portal-permissions'),
      user.role === 'client_owner' || user.role === 'client_super_admin'
        ? Promise.resolve(null)
        : api.get<OrgPerm | null>(`/org-permissions/${user.id}`).then(r => r.data),
    ])
      .then(([rolesResult, orgResult]) => {
        if (!current) return;
        const roleMap = rolesResult.status === 'fulfilled' ? rolesResult.value.data[user.role] : undefined;
        const orgPerm = orgResult.status === 'fulfilled' ? orgResult.value : null;
        const next: RoleMap = { ...(FALLBACK[user.role] ?? { map: ['view'] }), ...(roleMap ?? {}) };
        if (orgPerm) for (const feature of ['vehicles', 'alerts', 'geofences', 'pois']) {
          const actions = ['view', 'add', 'edit', 'delete'];
          next[feature] = actions.filter(action => orgPerm[`${feature}${action[0]!.toUpperCase()}${action.slice(1)}`] === true);
        }
        setPermissions(next);
        setResolvedUserId(user.id);
      })
      .catch(() => { if (current) { setPermissions(FALLBACK[user.role] ?? { map: ['view'] }); setResolvedUserId(user.id); } });
    return () => { current = false; };
  }, [user?.id, user?.role]);
  const value = useMemo(() => ({
    canDo: (feature: string, action = 'view') => resolvedUserId === user?.id && !!permissions[feature]?.includes(action),
    loading: !!user && resolvedUserId !== user.id,
  }), [permissions, resolvedUserId, user?.id]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePortalPermissions() {
  const value = useContext(Context);
  if (!value) throw new Error('usePortalPermissions must be used within PortalPermissionsProvider');
  return value;
}

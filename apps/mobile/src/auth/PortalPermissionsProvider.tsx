import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthProvider';

type RoleMap = Record<string, string[]>;
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
    api.get<Record<string, RoleMap>>('/role-portal-permissions')
      .then(response => { if (current) { setPermissions(response.data[user.role] ?? FALLBACK[user.role] ?? { map: ['view'] }); setResolvedUserId(user.id); } })
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

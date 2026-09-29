import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

interface PortalPermsContextValue {
  canDo: (feature: string, action: string) => boolean;
  loading: boolean;
}

const Ctx = createContext<PortalPermsContextValue | null>(null);

const FALLBACK: Record<string, Record<string, string[]>> = {
  client_owner:       { vehicles: ['view','add','edit','delete'], alerts: ['view','add','edit','delete'], geofences: ['view','add','edit','delete'], pois: ['view','add','edit','delete'], 'driver-behavior': ['view','edit'], maintenance: ['view','add','edit','delete'], reports: ['view'], users: ['view','add','edit','delete'] },
  client_super_admin: { vehicles: ['view','add','edit','delete'], alerts: ['view','add','edit','delete'], geofences: ['view','add','edit','delete'], pois: ['view','add','edit','delete'], 'driver-behavior': ['view','edit'], maintenance: ['view','add','edit','delete'], reports: ['view'], users: ['view','add','edit'] },
  client_admin:       { vehicles: ['view'], alerts: ['view'], geofences: ['view'], pois: ['view'], 'driver-behavior': ['view'], maintenance: ['view','add','edit'], reports: ['view'], users: ['view','add','edit'] },
  client_user:        { vehicles: ['view'], alerts: ['view'], 'driver-behavior': ['view'], maintenance: ['view'], reports: ['view'] },
};

export function PortalPermsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [perms, setPerms] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setPerms({}); setResolvedUserId(null); setLoading(false); return; }
    let current = true;
    setLoading(true);
    Promise.allSettled([
      api.get<Record<string, Record<string, string[]>>>('/role-portal-permissions'),
      user.role === 'client_owner'
        ? Promise.resolve(null)
        : api.get<Record<string, boolean | string[] | null> | null>(`/org-permissions/${user.id}`).then(r => r.data),
    ]).then(([roleResult, orgResult]) => {
      if (!current) return;
      const roleMap = roleResult.status === 'fulfilled' ? roleResult.value.data[user.role] : undefined;
      const orgPerm = orgResult.status === 'fulfilled' ? orgResult.value : null;
      const next: Record<string, string[]> = { ...(FALLBACK[user.role] ?? {}), ...(roleMap ?? {}) };
      if (orgPerm) for (const [feature, prefix] of Object.entries({
        vehicles: 'vehicles', alerts: 'alerts', geofences: 'geofences', pois: 'pois',
        'driver-behavior': 'driverBehavior', reports: 'reports', users: 'users',
        maintenance: 'maintenance',
      })) {
        const actions = feature === 'reports' ? ['view'] : feature === 'driver-behavior' ? ['view', 'edit'] : ['view', 'add', 'edit', 'delete'];
        const roleActions = next[feature] ?? [];
        next[feature] = actions.filter(action => {
          const override = orgPerm[`${prefix}${action[0]!.toUpperCase()}${action.slice(1)}`];
          return typeof override === 'boolean' ? override : roleActions.includes(action);
        });
      }
      setPerms(next);
      setResolvedUserId(user.id);
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [user?.id, user?.role]);

  function canDo(feature: string, action: string): boolean {
    return resolvedUserId === user?.id && !!(perms[feature]?.includes(action));
  }

  return (
    <Ctx.Provider value={{ canDo, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePortalPerms() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePortalPerms outside PortalPermsProvider');
  return ctx;
}

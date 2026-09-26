import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

interface PortalPermsContextValue {
  canDo: (feature: string, action: string) => boolean;
  loading: boolean;
}

const Ctx = createContext<PortalPermsContextValue | null>(null);

const FALLBACK: Record<string, Record<string, string[]>> = {
  client_owner:       { alerts: ['view','add','edit','delete'], geofences: ['view','add','edit','delete'], pois: ['view','add','edit','delete'], 'driver-behavior': ['view','edit'], reports: ['view'], users: ['view','add','edit','delete'] },
  client_super_admin: { alerts: ['view','add','edit','delete'], geofences: ['view','add','edit','delete'], pois: ['view','add','edit','delete'], 'driver-behavior': ['view','edit'], reports: ['view'], users: ['view','add','edit'] },
  client_admin:       { alerts: ['view'], geofences: ['view'], pois: ['view'], 'driver-behavior': ['view'] },
  client_user:        { alerts: ['view'], 'driver-behavior': ['view'] },
};

export function PortalPermsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [perms, setPerms] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api.get<Record<string, Record<string, string[]>>>('/role-portal-permissions')
      .then(r => {
        const rolePerms = r.data[user.role] ?? FALLBACK[user.role] ?? {};
        setPerms(rolePerms);
      })
      .catch(() => {
        setPerms(FALLBACK[user.role] ?? {});
      })
      .finally(() => setLoading(false));
  }, [user?.role]);

  function canDo(feature: string, action: string): boolean {
    return !!(perms[feature]?.includes(action));
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

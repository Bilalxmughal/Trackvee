import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/client';

// Map of role → page/feature → allowed actions
export type OrgPermsMap = Record<string, Record<string, string[]>>;

interface OrgRolePermsContextValue {
  perms: OrgPermsMap;
  loading: boolean;
  canOrgDo: (role: string, feature: string, action: string) => boolean;
  updatePerms: (next: OrgPermsMap) => Promise<void>;
}

const Ctx = createContext<OrgRolePermsContextValue | null>(null);

const FALLBACK: OrgPermsMap = {
  client_owner:       { dashboard: ['view'], map: ['view'], vehicles: ['view','add','edit','delete'], alerts: ['view','add','edit','delete'], geofences: ['view','add','edit','delete'], pois: ['view','add','edit','delete'], 'driver-behavior': ['view','edit'], users: ['view','add','edit','delete'] },
  client_super_admin: { dashboard: ['view'], map: ['view'], vehicles: ['view','add','edit','delete'], alerts: ['view','add','edit','delete'], geofences: ['view','add','edit','delete'], pois: ['view','add','edit','delete'], 'driver-behavior': ['view','edit'], users: ['view','add','edit'] },
  client_admin:       { dashboard: ['view'], map: ['view'], vehicles: ['view'], alerts: ['view'], geofences: ['view'], pois: ['view'], 'driver-behavior': ['view'], reports: ['view'], users: ['view','add','edit'] },
  client_user:        { dashboard: ['view'], map: ['view'], vehicles: ['view'], alerts: ['view'], 'driver-behavior': ['view'], reports: ['view'] },
};

export function OrgRolePermsProvider({ children }: { children: ReactNode }) {
  const [perms, setPerms] = useState<OrgPermsMap>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<OrgPermsMap>('/role-portal-permissions')
      .then(r => { if (Object.keys(r.data).length > 0) setPerms(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function canOrgDo(role: string, feature: string, action: string): boolean {
    return !!(perms[role]?.[feature]?.includes(action));
  }

  async function updatePerms(next: OrgPermsMap): Promise<void> {
    await api.put('/role-portal-permissions', next);
    setPerms(next);
  }

  return (
    <Ctx.Provider value={{ perms, loading, canOrgDo, updatePerms }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOrgRolePerms() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOrgRolePerms outside OrgRolePermsProvider');
  return ctx;
}

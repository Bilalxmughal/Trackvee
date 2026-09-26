import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

type RolePermsMap = Record<string, Record<string, string[]>>;

interface OrgPerm {
  vehiclesView: boolean;  vehiclesAdd: boolean;  vehiclesEdit: boolean;  vehiclesDelete: boolean;
  alertsView: boolean;    alertsAdd: boolean;    alertsEdit: boolean;    alertsDelete: boolean;
  geofencesView: boolean; geofencesAdd: boolean; geofencesEdit: boolean; geofencesDelete: boolean;
  poisView: boolean;      poisAdd: boolean;      poisEdit: boolean;      poisDelete: boolean;
  vehicleIds: string[] | null;
}

// Features that have per-user override support (via OrgPerm)
const OVERRIDE_FEATURES = new Set(['vehicles', 'alerts', 'geofences', 'pois']);

type OrgPermKey = keyof Omit<OrgPerm, 'vehicleIds'>;

function orgPermField(feature: string, action: string): OrgPermKey | null {
  if (!OVERRIDE_FEATURES.has(feature)) return null;
  return `${feature}${action.charAt(0).toUpperCase() + action.slice(1)}` as OrgPermKey;
}

const FALLBACK: RolePermsMap = {
  client_owner:       { map: ['view'], vehicles: ['view','add','edit','delete'], alerts: ['view','add','edit','delete'], geofences: ['view','add','edit','delete'], pois: ['view','add','edit','delete'], 'driver-behavior': ['view','edit'], reports: ['view'], users: ['view','add','edit','delete'] },
  client_super_admin: { map: ['view'], vehicles: ['view','add','edit','delete'], alerts: ['view','add','edit','delete'], geofences: ['view','add','edit','delete'], pois: ['view','add','edit','delete'], 'driver-behavior': ['view','edit'], reports: ['view'], users: ['view','add','edit'] },
  client_admin:       { map: ['view'], vehicles: ['view'], alerts: ['view'], geofences: ['view'], pois: ['view'], 'driver-behavior': ['view'], reports: ['view'], users: ['view','add','edit'] },
  client_user:        { map: ['view'], vehicles: ['view'], alerts: ['view'], 'driver-behavior': ['view'], reports: ['view'] },
};

interface PortalPermsContextValue {
  canDo: (feature: string, action: string) => boolean;
  loading: boolean;
}

const Ctx = createContext<PortalPermsContextValue | null>(null);

export function PortalPermsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [rolePerms, setRolePerms] = useState<RolePermsMap>(FALLBACK);
  const [userPerm, setUserPerm] = useState<OrgPerm | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchRole = api.get<RolePermsMap>('/role-portal-permissions')
      .then(r => { if (Object.keys(r.data).length > 0) setRolePerms(r.data); })
      .catch(() => {});

    const fetchUser = user.role === 'client_admin'
      ? api.get<OrgPerm>(`/org-permissions/${user.id}`)
          .then(r => setUserPerm(r.data))
          .catch(() => {})
      : Promise.resolve();

    Promise.all([fetchRole, fetchUser]).finally(() => setLoading(false));
  }, [user?.id]);

  function canDo(feature: string, action: string): boolean {
    if (!user) return false;
    const role = user.role;

    // client_admin: per-user OrgPerm overrides for CRUD-able modules
    if (role === 'client_admin' && userPerm !== null) {
      const field = orgPermField(feature, action);
      if (field !== null) return !!(userPerm[field]);
    }

    return !!(rolePerms[role]?.[feature]?.includes(action));
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

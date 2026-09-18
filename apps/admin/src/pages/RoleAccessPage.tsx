import { useState } from 'react';
import { IconCheck, IconX, IconShield, IconMapPin } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import { useCityFilter } from '../contexts/CityFilterContext';

type Action = 'view' | 'add' | 'edit' | 'delete';
type Role = 'super_admin' | 'org_admin' | 'dispatcher' | 'viewer' | 'customer';

interface PageDef { key: string; label: string; actions: Action[]; group: string; }

const PAGES: PageDef[] = [
  { key: 'dashboard', label: 'Dashboard', actions: ['view'], group: 'Main' },
  { key: 'organizations', label: 'Organizations', actions: ['view', 'add', 'edit', 'delete'], group: 'Main' },
  { key: 'vehicles', label: 'Vehicles', actions: ['view', 'add', 'edit', 'delete'], group: 'Main' },
  { key: 'devices', label: 'Devices', actions: ['view', 'add', 'edit', 'delete'], group: 'Main' },
  { key: 'telemetry', label: 'Telemetry', actions: ['view'], group: 'Main' },
  { key: 'users', label: 'User Management', actions: ['view', 'add', 'edit', 'delete'], group: 'Administration' },
  { key: 'roles', label: 'Role Access', actions: ['view', 'edit'], group: 'Administration' },
];

const ROLES: { key: Role; label: string; isSystem?: boolean }[] = [
  { key: 'super_admin', label: 'Super Admin', isSystem: true },
  { key: 'org_admin', label: 'Org Admin' },
  { key: 'dispatcher', label: 'Dispatcher' },
  { key: 'viewer', label: 'Viewer' },
  { key: 'customer', label: 'Customer' },
];

const ALL_ACTIONS: Action[] = ['view', 'add', 'edit', 'delete'];

type PermMatrix = Record<Role, Record<string, Record<Action, boolean>>>;

const DEFAULT: PermMatrix = {
  super_admin: Object.fromEntries(PAGES.map(p => [p.key, Object.fromEntries(ALL_ACTIONS.map(a => [a, true]))])) as Record<string, Record<Action, boolean>>,
  customer: {
    dashboard: { view: true, add: false, edit: false, delete: false },
    organizations: { view: false, add: false, edit: false, delete: false },
    vehicles: { view: true, add: false, edit: false, delete: false },
    devices: { view: false, add: false, edit: false, delete: false },
    telemetry: { view: true, add: false, edit: false, delete: false },
    users: { view: false, add: false, edit: false, delete: false },
    roles: { view: false, add: false, edit: false, delete: false },
  },
  org_admin: {
    dashboard: { view: true, add: false, edit: false, delete: false },
    organizations: { view: true, add: true, edit: true, delete: false },
    vehicles: { view: true, add: true, edit: true, delete: false },
    devices: { view: true, add: true, edit: true, delete: false },
    telemetry: { view: true, add: false, edit: false, delete: false },
    users: { view: true, add: true, edit: true, delete: false },
    roles: { view: false, add: false, edit: false, delete: false },
  },
  dispatcher: {
    dashboard: { view: true, add: false, edit: false, delete: false },
    organizations: { view: false, add: false, edit: false, delete: false },
    vehicles: { view: true, add: false, edit: false, delete: false },
    devices: { view: true, add: false, edit: false, delete: false },
    telemetry: { view: true, add: false, edit: false, delete: false },
    users: { view: false, add: false, edit: false, delete: false },
    roles: { view: false, add: false, edit: false, delete: false },
  },
  viewer: {
    dashboard: { view: true, add: false, edit: false, delete: false },
    organizations: { view: false, add: false, edit: false, delete: false },
    vehicles: { view: true, add: false, edit: false, delete: false },
    devices: { view: false, add: false, edit: false, delete: false },
    telemetry: { view: true, add: false, edit: false, delete: false },
    users: { view: false, add: false, edit: false, delete: false },
    roles: { view: false, add: false, edit: false, delete: false },
  },
};

const GROUPS = ['Main', 'Administration'];

const cellBtn = (on: boolean, disabled: boolean, onClick: () => void): React.CSSProperties => ({
  width: 30, height: 30, border: 0, borderRadius: 5, cursor: disabled ? 'default' : 'pointer',
  background: on ? 'rgba(34,197,94,0.12)' : 'var(--bg3)',
  color: on ? '#16a34a' : '#bbb',
  display: 'grid', placeItems: 'center',
  transition: 'background 0.15s, color 0.15s',
  opacity: disabled ? 0.5 : 1,
});

export default function RoleAccessPage() {
  const [perms, setPerms] = useState<PermMatrix>(DEFAULT);
  const [activeRole, setActiveRole] = useState<Role>('org_admin');
  const [saved, setSaved] = useState(false);
  const { cities } = useCityFilter();
  const [cityPerms, setCityPerms] = useState<Record<Role, { all: boolean; ids: string[] }>>({
    super_admin: { all: true, ids: [] },
    org_admin: { all: true, ids: [] },
    dispatcher: { all: true, ids: [] },
    viewer: { all: true, ids: [] },
    customer: { all: false, ids: [] },
  });

  const toggleCityAll = () => {
    if (activeRole === 'super_admin') return;
    setCityPerms(p => ({ ...p, [activeRole]: { all: !p[activeRole].all, ids: [] } }));
    setSaved(false);
  };
  const toggleCity = (id: string) => {
    if (activeRole === 'super_admin') return;
    setCityPerms(p => {
      const cur = p[activeRole];
      const ids = cur.ids.includes(id) ? cur.ids.filter(x => x !== id) : [...cur.ids, id];
      return { ...p, [activeRole]: { all: false, ids } };
    });
    setSaved(false);
  };

  const toggle = (page: string, action: Action) => {
    if (activeRole === 'super_admin') return;
    setPerms(prev => ({
      ...prev,
      [activeRole]: {
        ...prev[activeRole],
        [page]: { ...prev[activeRole][page], [action]: !prev[activeRole][page][action] },
      },
    }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const activeRoleDef = ROLES.find(r => r.key === activeRole)!;
  const isReadOnly = activeRole === 'super_admin';

  return (
    <div>
      <PageHeader title="Role Access" action={
        !isReadOnly ? (
          <button
            onClick={handleSave}
            style={{ padding: '6px 16px', background: saved ? '#16a34a' : '#dc2626', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
          >
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        ) : undefined
      } />

      <div style={{ display: 'flex', height: 'calc(100vh - 110px)' }}>
        {/* Role list */}
        <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
          <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>
            Roles
          </div>
          {ROLES.map(role => {
            const on = activeRole === role.key;
            const count = PAGES.filter(p => perms[role.key][p.key]?.view).length;
            return (
              <button
                key={role.key}
                onClick={() => setActiveRole(role.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', border: 0, textAlign: 'left', cursor: 'pointer',
                  background: on ? 'rgba(220,38,38,0.06)' : 'transparent',
                  borderLeft: `3px solid ${on ? '#dc2626' : 'transparent'}`,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--bg2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = on ? 'rgba(220,38,38,0.06)' : 'transparent'; }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: on ? 600 : 400, color: on ? '#dc2626' : 'var(--text)' }}>{role.label}</div>
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 1 }}>
                    {role.key === 'super_admin' ? 'Full access' : `${count}/${PAGES.length} pages`}
                  </div>
                </div>
                {on && <IconShield size={13} color="#dc2626" />}
              </button>
            );
          })}
        </div>

        {/* Permission grid */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{activeRoleDef.label} permissions</div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                {isReadOnly ? 'Super Admin always has full access' : 'Click a cell to toggle permission'}
              </div>
            </div>
          </div>

          {isReadOnly && (
            <div style={{ margin: '12px 20px', padding: '10px 14px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#dc2626' }}>
              <IconShield size={14} /> Super Admin always has full access — permissions cannot be restricted.
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
                <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6, width: 180 }}>Page</th>
                {ALL_ACTIONS.map(a => (
                  <th key={a} style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6 }}>{a}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map(group => {
                const groupPages = PAGES.filter(p => p.group === group);
                return (
                  <>
                    <tr key={group} style={{ background: 'var(--bg3)' }}>
                      <td colSpan={5} style={{ padding: '7px 20px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid var(--border)' }}>
                        {group}
                      </td>
                    </tr>
                    {groupPages.map(page => (
                      <tr key={page.key} style={{ borderBottom: '1px solid var(--border2)' }}>
                        <td style={{ padding: '10px 20px', color: 'var(--text)', fontSize: 13, fontWeight: 400 }}>{page.label}</td>
                        {ALL_ACTIONS.map(action => {
                          const hasAction = page.actions.includes(action);
                          if (!hasAction) {
                            return <td key={action} style={{ padding: '10px 16px', textAlign: 'center', color: '#e0e0e0', fontSize: 14 }}>—</td>;
                          }
                          const on = perms[activeRole]?.[page.key]?.[action] ?? false;
                          return (
                            <td key={action} style={{ padding: '10px 16px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => toggle(page.key, action)}
                                disabled={isReadOnly}
                                style={cellBtn(on, isReadOnly, () => {})}
                              >
                                {on ? <IconCheck size={13} /> : <IconX size={13} />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
          {cities.length > 0 && (
            <div style={{ padding: '16px 20px', borderTop: '2px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <IconMapPin size={14} color="#dc2626" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>City Access</span>
                <span style={{ fontSize: 11, color: '#bbb', marginLeft: 4 }}>
                  {isReadOnly ? 'Super Admin has access to all cities' : 'Select which cities this role can access'}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: isReadOnly ? 'default' : 'pointer', padding: '5px 10px', border: `1px solid ${cityPerms[activeRole].all || isReadOnly ? '#dc2626' : 'var(--border)'}`, borderRadius: 6, background: cityPerms[activeRole].all || isReadOnly ? 'rgba(220,38,38,0.06)' : 'transparent', color: cityPerms[activeRole].all || isReadOnly ? '#dc2626' : 'var(--text)', transition: 'all 0.15s' }}>
                  <input type="checkbox" checked={cityPerms[activeRole].all || isReadOnly} onChange={toggleCityAll} disabled={isReadOnly} style={{ accentColor: '#dc2626' }} />
                  All Cities
                </label>
                {cities.map(city => {
                  const checked = isReadOnly || cityPerms[activeRole].all || cityPerms[activeRole].ids.includes(city.id);
                  return (
                    <label key={city.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: isReadOnly ? 'default' : 'pointer', padding: '5px 10px', border: `1px solid ${checked ? '#dc2626' : 'var(--border)'}`, borderRadius: 6, background: checked ? 'rgba(220,38,38,0.06)' : 'transparent', color: checked ? '#dc2626' : 'var(--text)', transition: 'all 0.15s', opacity: cityPerms[activeRole].all && !isReadOnly ? 0.5 : 1 }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleCity(city.id)} disabled={isReadOnly || cityPerms[activeRole].all} style={{ accentColor: '#dc2626' }} />
                      {city.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

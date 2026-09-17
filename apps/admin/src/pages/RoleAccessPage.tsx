import { useState } from 'react';
import { IconCheck, IconX, IconShield } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';

type Action = 'view' | 'add' | 'edit' | 'delete';
type Role = 'super_admin' | 'org_admin' | 'dispatcher' | 'viewer';

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
];

const ALL_ACTIONS: Action[] = ['view', 'add', 'edit', 'delete'];

type PermMatrix = Record<Role, Record<string, Record<Action, boolean>>>;

const DEFAULT: PermMatrix = {
  super_admin: Object.fromEntries(PAGES.map(p => [p.key, Object.fromEntries(ALL_ACTIONS.map(a => [a, true]))])) as Record<string, Record<Action, boolean>>,
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
  background: on ? 'rgba(34,197,94,0.12)' : 'rgba(0,0,0,0.04)',
  color: on ? '#16a34a' : '#bbb',
  display: 'grid', placeItems: 'center',
  transition: 'background 0.15s, color 0.15s',
  opacity: disabled ? 0.5 : 1,
});

export default function RoleAccessPage() {
  const [perms, setPerms] = useState<PermMatrix>(DEFAULT);
  const [activeRole, setActiveRole] = useState<Role>('org_admin');
  const [saved, setSaved] = useState(false);

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
        <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid #f0f0f0', overflowY: 'auto' }}>
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
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = '#f8f8f8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = on ? 'rgba(220,38,38,0.06)' : 'transparent'; }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: on ? 600 : 400, color: on ? '#dc2626' : '#333' }}>{role.label}</div>
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
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{activeRoleDef.label} permissions</div>
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
              <tr style={{ borderBottom: '1.5px solid #f0f0f0' }}>
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
                    <tr key={group} style={{ background: '#f9f9f9' }}>
                      <td colSpan={5} style={{ padding: '7px 20px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #f0f0f0' }}>
                        {group}
                      </td>
                    </tr>
                    {groupPages.map(page => (
                      <tr key={page.key} style={{ borderBottom: '1px solid #f8f8f8' }}>
                        <td style={{ padding: '10px 20px', color: '#333', fontSize: 13, fontWeight: 400 }}>{page.label}</td>
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
        </div>
      </div>
    </div>
  );
}

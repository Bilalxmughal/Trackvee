import { useState } from 'react';
import { IconShield, IconCheck, IconMinus } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import { ROLE_PERMISSIONS, ROLE_TOPBAR, ROLE_LABEL, INTERNAL_ROLES, type PageAction } from '../config/roles';
import type { UserRole } from '@yotrack/types';

interface PageRow { key: string; label: string; group: string; actions: PageAction[]; }

const PAGES: PageRow[] = [
  { key: 'dashboard', label: 'Dashboard',       group: 'Core',           actions: ['view'] },
  { key: 'map',       label: 'Live Map',         group: 'Core',           actions: ['view'] },
  { key: 'telemetry', label: 'Telemetry',        group: 'Core',           actions: ['view'] },
  { key: 'clients',   label: 'Clients',          group: 'Management',     actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'vehicles',  label: 'Vehicles',         group: 'Management',     actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'devices',   label: 'Devices',          group: 'Management',     actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'setup',     label: 'Setup Guide',      group: 'Management',     actions: ['view'] },
  { key: 'users',     label: 'User Management',  group: 'Administration', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'roles',     label: 'Role Access',      group: 'Administration', actions: ['view'] },
  { key: 'settings',  label: 'Settings',         group: 'Administration', actions: ['view', 'edit'] },
];

const TOPBAR_FEATURES = [
  { key: 'alerts',    label: 'Alerts' },
  { key: 'geofences', label: 'Geofences' },
  { key: 'pois',      label: 'POIs' },
];

const GROUPS = ['Core', 'Management', 'Administration'];
const ACTION_LABEL: Record<PageAction, string> = { view: 'View', add: 'Add', edit: 'Edit', delete: 'Delete' };
const ACTION_COLOR: Record<PageAction, string> = {
  view: '#3b82f6', add: '#16a34a', edit: '#f59e0b', delete: '#dc2626',
};

function ActionCell({ on, action, na }: { on: boolean; action: PageAction; na?: boolean }) {
  if (na) {
    return (
      <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--border)' }}>
        <div style={{ width: 26, height: 26, margin: '0 auto', display: 'grid', placeItems: 'center', color: 'var(--border)' }}>
          <IconMinus size={11} />
        </div>
      </td>
    );
  }
  return (
    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
      <div style={{
        width: 26, height: 26, borderRadius: 5, margin: '0 auto',
        display: 'grid', placeItems: 'center',
        background: on ? `${ACTION_COLOR[action]}18` : 'var(--bg3)',
        color: on ? ACTION_COLOR[action] : '#ccc',
      }}>
        {on ? <IconCheck size={12} strokeWidth={2.5} /> : <IconMinus size={12} />}
      </div>
    </td>
  );
}

export default function RoleAccessPage() {
  const [activeRole, setActiveRole] = useState<UserRole>('admin');
  const perms = ROLE_PERMISSIONS[activeRole] ?? {};
  const topbar = ROLE_TOPBAR[activeRole] ?? [];

  return (
    <div>
      <PageHeader title="Role Access" />

      <div style={{ display: 'flex', height: 'calc(100vh - 110px)' }}>
        {/* Role sidebar */}
        <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
          <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>
            Internal Roles
          </div>
          {INTERNAL_ROLES.map(role => {
            const on = activeRole === role;
            const pageCount = Object.keys(ROLE_PERMISSIONS[role] ?? {}).length;
            return (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
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
                  <div style={{ fontSize: 13, fontWeight: on ? 600 : 400, color: on ? '#dc2626' : 'var(--text)' }}>
                    {ROLE_LABEL[role]}
                  </div>
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 1 }}>
                    {role === 'super_admin' ? 'Full access' : `${pageCount} pages`}
                  </div>
                </div>
                {on && <IconShield size={13} color="#dc2626" />}
              </button>
            );
          })}
        </div>

        {/* Permission matrix */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          {/* Header */}
          <div style={{ padding: '12px 20px 10px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              {ROLE_LABEL[activeRole]} — Page Permissions
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
              Read-only. Edit via code in <code style={{ fontSize: 11, background: 'var(--bg3)', padding: '1px 5px', borderRadius: 3 }}>src/config/roles.ts</code>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border)', background: 'var(--bg2)' }}>
                <th style={{ padding: '9px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6, width: 160 }}>
                  Page
                </th>
                {(['view', 'add', 'edit', 'delete'] as PageAction[]).map(a => (
                  <th key={a} style={{ padding: '9px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: ACTION_COLOR[a], textTransform: 'uppercase', letterSpacing: 0.6, minWidth: 64 }}>
                    {ACTION_LABEL[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map(group => {
                const groupPages = PAGES.filter(p => p.group === group);
                return (
                  <>
                    <tr key={group} style={{ background: 'var(--bg3)' }}>
                      <td colSpan={5} style={{ padding: '6px 20px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid var(--border)' }}>
                        {group}
                      </td>
                    </tr>
                    {groupPages.map(page => {
                      const allowed = perms[page.key] ?? [];
                      return (
                        <tr key={page.key} style={{ borderBottom: '1px solid var(--border2)' }}>
                          <td style={{ padding: '9px 20px', color: allowed.length ? 'var(--text)' : 'var(--muted)', fontWeight: allowed.length ? 500 : 400 }}>
                            {page.label}
                          </td>
                          {(['view', 'add', 'edit', 'delete'] as PageAction[]).map(action => (
                            <ActionCell
                              key={action}
                              action={action}
                              on={allowed.includes(action)}
                              na={!page.actions.includes(action)}
                            />
                          ))}
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>

          {/* Topbar features */}
          <div style={{ padding: '14px 20px 0', borderTop: '2px solid var(--border)', marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Topbar Features
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 16 }}>
              {TOPBAR_FEATURES.map(f => {
                const on = topbar.includes(f.key);
                return (
                  <div key={f.key} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 6, fontSize: 12.5,
                    border: `1px solid ${on ? '#22c55e' : 'var(--border)'}`,
                    background: on ? 'rgba(34,197,94,0.07)' : 'var(--bg3)',
                    color: on ? '#16a34a' : 'var(--muted)',
                    fontWeight: on ? 600 : 400,
                  }}>
                    {on ? <IconCheck size={12} strokeWidth={2.5} /> : <IconMinus size={12} />}
                    {f.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

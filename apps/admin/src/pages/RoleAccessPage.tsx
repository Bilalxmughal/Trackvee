import { useState } from 'react';
import { IconShield, IconCheck, IconMinus, IconLock } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import { ROLE_PERMISSIONS, TOPBAR_PERMISSIONS, ROLE_LABEL, INTERNAL_ROLES, canManageRole, ORG_ROLE_PORTAL_PERMISSIONS, ORG_ROLES, ORG_ROLE_LABEL, type PageAction } from '../config/roles';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '@yotrack/types';

interface PageRow  { key: string; label: string; group: string; actions: PageAction[]; }
interface TopbarRow { key: string; label: string; }

const PAGES: PageRow[] = [
  { key: 'dashboard', label: 'Dashboard',      group: 'Core',           actions: ['view'] },
  { key: 'map',       label: 'Live Map',        group: 'Core',           actions: ['view'] },
  { key: 'telemetry', label: 'Telemetry',       group: 'Core',           actions: ['view'] },
  { key: 'clients',   label: 'Clients',         group: 'Management',     actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'vehicles',  label: 'Vehicles',        group: 'Management',     actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'devices',   label: 'Devices',         group: 'Management',     actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'setup',     label: 'Setup Guide',     group: 'Management',     actions: ['view'] },
  { key: 'users',     label: 'User Management', group: 'Administration', actions: ['view', 'add', 'edit', 'delete'] },
  { key: 'roles',     label: 'Role Access',     group: 'Administration', actions: ['view'] },
  { key: 'settings',  label: 'Settings',        group: 'Administration', actions: ['view', 'edit'] },
];

const TOPBAR_ROWS: TopbarRow[] = [
  { key: 'alerts',    label: 'Alerts' },
  { key: 'geofences', label: 'Geofences' },
  { key: 'pois',      label: 'POIs' },
];

const GROUPS = ['Core', 'Management', 'Administration'];
const ALL_ACTIONS: PageAction[] = ['view', 'add', 'edit', 'delete'];
const ACTION_LABEL: Record<PageAction, string> = { view: 'View', add: 'Add', edit: 'Edit', delete: 'Delete' };
const ACTION_COLOR: Record<PageAction, string> = {
  view: '#3b82f6', add: '#16a34a', edit: '#f59e0b', delete: '#dc2626',
};

type PermMap = Partial<Record<string, PageAction[]>>;
type AllPerms = Partial<Record<UserRole, PermMap>>;

function deepClone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

function Cell({ on, action, na, locked, onClick }: {
  on: boolean; action: PageAction; na?: boolean; locked?: boolean; onClick?: () => void;
}) {
  if (na) {
    return <td style={{ padding: '8px 10px', textAlign: 'center' }}><div style={{ width: 26, height: 26, margin: '0 auto', display: 'grid', placeItems: 'center', color: 'var(--border)' }}><IconMinus size={10} /></div></td>;
  }
  return (
    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
      <button
        type="button"
        disabled={locked}
        onClick={onClick}
        title={locked ? 'Cannot modify' : (on ? 'Click to revoke' : 'Click to grant')}
        style={{
          width: 26, height: 26, borderRadius: 5, margin: '0 auto', border: 0,
          display: 'grid', placeItems: 'center', cursor: locked ? 'not-allowed' : 'pointer',
          background: locked ? 'var(--bg3)' : on ? `${ACTION_COLOR[action]}18` : 'var(--bg3)',
          color: locked ? '#ccc' : on ? ACTION_COLOR[action] : '#ccc',
          transition: 'background 0.15s, color 0.15s',
          opacity: locked ? 0.5 : 1,
        }}
      >
        {locked ? <IconLock size={10} /> : on ? <IconCheck size={12} strokeWidth={2.5} /> : <IconMinus size={12} />}
      </button>
    </td>
  );
}

export default function RoleAccessPage() {
  const { user } = useAuth();
  const currentRole = (user?.role ?? 'viewer') as UserRole;
  const isSuperAdmin = currentRole === 'super_admin';

  const [activeRole, setActiveRole] = useState<UserRole>('admin');
  const [pagePerms, setPagePerms]     = useState<AllPerms>(() => deepClone(ROLE_PERMISSIONS));
  const [topbarPerms, setTopbarPerms] = useState<AllPerms>(() => deepClone(TOPBAR_PERMISSIONS));
  const [saved, setSaved] = useState(false);

  const canEdit = canManageRole(currentRole, activeRole);
  const isLockedRole = activeRole === 'super_admin';

  function togglePage(action: PageAction, pageKey: string) {
    if (!canEdit) return;
    setPagePerms(prev => {
      const next = deepClone(prev);
      const rolePerms = next[activeRole] ?? {};
      const cur = rolePerms[pageKey] ?? [];
      if (cur.includes(action)) {
        rolePerms[pageKey] = cur.filter(a => a !== action);
      } else {
        rolePerms[pageKey] = [...cur, action];
        // granting add/edit/delete auto-grants view
        if (action !== 'view' && !rolePerms[pageKey].includes('view')) {
          rolePerms[pageKey].push('view');
        }
      }
      next[activeRole] = rolePerms;
      return next;
    });
    setSaved(false);
  }

  function toggleTopbar(action: PageAction, featureKey: string) {
    if (!canEdit) return;
    setTopbarPerms(prev => {
      const next = deepClone(prev);
      const rolePerms = next[activeRole] ?? {};
      const cur = rolePerms[featureKey] ?? [];
      if (cur.includes(action)) {
        rolePerms[featureKey] = cur.filter(a => a !== action);
      } else {
        rolePerms[featureKey] = [...cur, action];
        if (action !== 'view' && !rolePerms[featureKey].includes('view')) {
          rolePerms[featureKey].push('view');
        }
      }
      next[activeRole] = rolePerms;
      return next;
    });
    setSaved(false);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const activePagePerms   = pagePerms[activeRole]   ?? {};
  const activeTopbarPerms = topbarPerms[activeRole] ?? {};

  return (
    <div>
      <PageHeader
        title="Role Access"
        action={
          canEdit ? (
            <button
              onClick={handleSave}
              style={{ padding: '6px 16px', background: saved ? '#16a34a' : '#dc2626', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
            >
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          ) : undefined
        }
      />

      <div style={{ display: 'flex', height: 'calc(100vh - 110px)' }}>
        {/* Role sidebar */}
        <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
          <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>
            Internal Roles
          </div>
          {INTERNAL_ROLES.map(role => {
            const on = activeRole === role;
            const locked = role === 'super_admin';
            const editable = canManageRole(currentRole, role);
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
                  <div style={{ fontSize: 13, fontWeight: on ? 600 : 400, color: locked ? '#aaa' : on ? '#dc2626' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {locked && <IconLock size={11} />}
                    {ROLE_LABEL[role]}
                  </div>
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 1 }}>
                    {locked ? 'System — Full Access' : editable ? 'Editable' : 'Read-only'}
                  </div>
                </div>
                {on && <IconShield size={13} color={locked ? '#aaa' : '#dc2626'} />}
              </button>
            );
          })}

          {/* Legend */}
          <div style={{ padding: '14px 16px 10px', borderTop: '1px solid var(--border)', marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Your access</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
              {isSuperAdmin
                ? 'You can edit all roles except Super Admin (system role).'
                : currentRole === 'admin'
                  ? 'You can edit Ops, Live Ops, Agent, Chat Support, Viewer. Super Admin and Admin are locked.'
                  : 'Read-only view.'}
            </div>
          </div>
        </div>

        {/* Permission matrix */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          {/* Header */}
          <div style={{ padding: '12px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {isLockedRole && <IconLock size={14} color="#aaa" />}
                {ROLE_LABEL[activeRole]}
                {isLockedRole && <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400, marginLeft: 4 }}>System Role — Always Full Access</span>}
              </div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                {canEdit
                  ? 'Click cells to toggle permissions. Save when done.'
                  : isLockedRole
                    ? 'Super Admin permissions are fixed and cannot be modified by anyone.'
                    : 'You do not have permission to edit this role.'}
              </div>
            </div>
          </div>

          {/* Pages table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border)', background: 'var(--bg2)' }}>
                <th style={{ padding: '9px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6, width: 160 }}>Page</th>
                {ALL_ACTIONS.map(a => (
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
                      const allowed = activePagePerms[page.key] ?? [];
                      return (
                        <tr key={page.key} style={{ borderBottom: '1px solid var(--border2)' }}>
                          <td style={{ padding: '9px 20px', color: allowed.length ? 'var(--text)' : 'var(--muted)', fontWeight: allowed.length ? 500 : 400 }}>
                            {page.label}
                          </td>
                          {ALL_ACTIONS.map(action => (
                            <Cell
                              key={action}
                              action={action}
                              on={allowed.includes(action)}
                              na={!page.actions.includes(action)}
                              locked={!canEdit}
                              onClick={() => togglePage(action, page.key)}
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

          {/* Topbar CRUD */}
          <div style={{ borderTop: '2px solid var(--border)', marginTop: 4 }}>
            <div style={{ padding: '12px 20px 0', marginBottom: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Topbar Features</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--border)', background: 'var(--bg2)' }}>
                  <th style={{ padding: '9px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6, width: 160 }}>Feature</th>
                  {ALL_ACTIONS.map(a => (
                    <th key={a} style={{ padding: '9px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: ACTION_COLOR[a], textTransform: 'uppercase', letterSpacing: 0.6, minWidth: 64 }}>
                      {ACTION_LABEL[a]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOPBAR_ROWS.map(feat => {
                  const allowed = activeTopbarPerms[feat.key] ?? [];
                  return (
                    <tr key={feat.key} style={{ borderBottom: '1px solid var(--border2)' }}>
                      <td style={{ padding: '9px 20px', color: allowed.length ? 'var(--text)' : 'var(--muted)', fontWeight: allowed.length ? 500 : 400 }}>
                        {feat.label}
                      </td>
                      {ALL_ACTIONS.map(action => (
                        <Cell
                          key={action}
                          action={action}
                          on={allowed.includes(action)}
                          locked={!canEdit}
                          onClick={() => toggleTopbar(action, feat.key)}
                        />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Org Roles Portal Permissions */}
          <div style={{ borderTop: '2px solid var(--border)', marginTop: 4 }}>
            <div style={{ padding: '12px 20px 4px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Client Portal Roles</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Default portal page permissions per org role. These are system defaults — org_user permissions can be further customized per user.</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 4 }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--border)', background: 'var(--bg2)' }}>
                  <th style={{ padding: '9px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6, width: 160 }}>Page</th>
                  {ORG_ROLES.map(role => (
                    <th key={role} style={{ padding: '9px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.6, minWidth: 80 }}>
                      {ORG_ROLE_LABEL[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['dashboard', 'map', 'vehicles', 'alerts', 'geofences', 'pois', 'users'].map(pageKey => {
                  const labels: Record<string, string> = { dashboard: 'Dashboard', map: 'Live Map', vehicles: 'Vehicles', alerts: 'Alerts', geofences: 'Geofences', pois: 'POIs', users: 'Users' };
                  return (
                    <tr key={pageKey} style={{ borderBottom: '1px solid var(--border2)' }}>
                      <td style={{ padding: '9px 20px', fontWeight: 500 }}>{labels[pageKey]}</td>
                      {ORG_ROLES.map(role => {
                        const actions = ORG_ROLE_PORTAL_PERMISSIONS[role]?.[pageKey] ?? [];
                        return (
                          <td key={role} style={{ padding: '9px 10px', textAlign: 'center' }}>
                            {actions.length === 0
                              ? <span style={{ color: '#e5e7eb', fontSize: 11 }}>—</span>
                              : <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {actions.map(a => (
                                    <span key={a} style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: `${ACTION_COLOR[a as PageAction]}18`, color: ACTION_COLOR[a as PageAction], fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                      {a}
                                    </span>
                                  ))}
                                </div>
                            }
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
            <IconShield size={12} color="#dc2626" />
            All internal roles have no organization — they see all data globally. Granting Add/Edit/Delete auto-grants View.
          </div>
        </div>
      </div>
    </div>
  );
}

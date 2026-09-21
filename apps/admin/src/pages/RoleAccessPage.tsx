import { useState, useEffect } from 'react';
import { IconShield, IconCheck, IconMinus, IconLock } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import { ROLE_PERMISSIONS, TOPBAR_PERMISSIONS, ROLE_LABEL, INTERNAL_ROLES, canManageRole, ORG_ROLE_PORTAL_PERMISSIONS, ORG_ROLES, ORG_ROLE_LABEL, ORG_PORTAL_PAGES, ORG_PORTAL_GROUPS, type PageAction } from '../config/roles';
import { useAuth } from '../contexts/AuthContext';
import { useOrgRolePerms } from '../contexts/OrgRolePermsContext';
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

// Imported from roles.ts — ORG_PORTAL_PAGES is the single source of truth
const ORG_PAGES: PageRow[] = ORG_PORTAL_PAGES;

const TOPBAR_ROWS: TopbarRow[] = [
  { key: 'alerts',    label: 'Alerts' },
  { key: 'geofences', label: 'Geofences' },
  { key: 'pois',      label: 'POIs' },
];

const GROUPS       = ['Core', 'Management', 'Administration'];
const ORG_GROUPS   = ORG_PORTAL_GROUPS;
const ALL_ACTIONS: PageAction[] = ['view', 'add', 'edit', 'delete'];
const ACTION_LABEL: Record<PageAction, string> = { view: 'View', add: 'Add', edit: 'Edit', delete: 'Delete' };
const ACTION_COLOR: Record<PageAction, string> = { view: '#3b82f6', add: '#16a34a', edit: '#f59e0b', delete: '#dc2626' };

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
      <button type="button" disabled={locked} onClick={onClick}
        title={locked ? 'Cannot modify' : (on ? 'Click to revoke' : 'Click to grant')}
        style={{ width: 26, height: 26, borderRadius: 5, margin: '0 auto', border: 0, display: 'grid', placeItems: 'center', cursor: locked ? 'not-allowed' : 'pointer', background: locked ? 'var(--bg3)' : on ? `${ACTION_COLOR[action]}18` : 'var(--bg3)', color: locked ? '#ccc' : on ? ACTION_COLOR[action] : '#ccc', transition: 'background 0.15s, color 0.15s', opacity: locked ? 0.5 : 1 }}>
        {locked ? <IconLock size={10} /> : on ? <IconCheck size={12} strokeWidth={2.5} /> : <IconMinus size={12} />}
      </button>
    </td>
  );
}

export default function RoleAccessPage() {
  const { user } = useAuth();
  const { perms: loadedOrgPerms, updatePerms } = useOrgRolePerms();
  const currentRole = (user?.role ?? 'viewer') as UserRole;
  const isSuperAdmin = currentRole === 'super_admin';

  // Section toggle: Trackvee internal roles vs Client portal roles
  const [section, setSection] = useState<'trackvee' | 'client'>('trackvee');

  // Trackvee state
  const [activeRole, setActiveRole]       = useState<UserRole>('admin');
  const [pagePerms, setPagePerms]         = useState<AllPerms>(() => deepClone(ROLE_PERMISSIONS));
  const [topbarPerms, setTopbarPerms]     = useState<AllPerms>(() => deepClone(TOPBAR_PERMISSIONS));

  // Client portal state — seeded from API via context
  const [activeOrgRole, setActiveOrgRole] = useState<UserRole>('org_admin');
  const [orgPerms, setOrgPerms]           = useState<AllPerms>(() => deepClone(ORG_ROLE_PORTAL_PERMISSIONS));
  const [saveLoading, setSaveLoading]     = useState(false);
  const [saved, setSaved]                 = useState(false);

  // Sync from API once loaded
  useEffect(() => {
    if (Object.keys(loadedOrgPerms).length > 0) setOrgPerms(deepClone(loadedOrgPerms) as AllPerms);
  }, [JSON.stringify(loadedOrgPerms)]);

  // Trackvee helpers
  const canEdit       = canManageRole(currentRole, activeRole);
  const isLockedRole  = activeRole === 'super_admin';

  function togglePage(action: PageAction, pageKey: string) {
    if (!canEdit) return;
    setPagePerms(prev => {
      const next = deepClone(prev);
      const rp = next[activeRole] ?? {};
      const cur = rp[pageKey] ?? [];
      if (cur.includes(action)) { rp[pageKey] = cur.filter(a => a !== action); }
      else { rp[pageKey] = [...cur, action]; if (action !== 'view' && !rp[pageKey].includes('view')) rp[pageKey].push('view'); }
      next[activeRole] = rp;
      return next;
    });
    setSaved(false);
  }

  function toggleTopbar(action: PageAction, featureKey: string) {
    if (!canEdit) return;
    setTopbarPerms(prev => {
      const next = deepClone(prev);
      const rp = next[activeRole] ?? {};
      const cur = rp[featureKey] ?? [];
      if (cur.includes(action)) { rp[featureKey] = cur.filter(a => a !== action); }
      else { rp[featureKey] = [...cur, action]; if (action !== 'view' && !rp[featureKey].includes('view')) rp[featureKey].push('view'); }
      next[activeRole] = rp;
      return next;
    });
    setSaved(false);
  }

  // Client portal helpers
  const isOrgOwner    = activeOrgRole === 'org_owner';
  const canEditOrg    = isSuperAdmin && !isOrgOwner;

  function toggleOrgPage(action: PageAction, pageKey: string) {
    if (!canEditOrg) return;
    setOrgPerms(prev => {
      const next = deepClone(prev);
      const rp = next[activeOrgRole] ?? {};
      const cur = rp[pageKey] ?? [];
      if (cur.includes(action)) { rp[pageKey] = cur.filter(a => a !== action); }
      else { rp[pageKey] = [...cur, action]; if (action !== 'view' && !rp[pageKey].includes('view')) rp[pageKey].push('view'); }
      next[activeOrgRole] = rp;
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    if (section === 'client') {
      setSaveLoading(true);
      try {
        await updatePerms(orgPerms as Record<string, Record<string, string[]>>);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch { /* no-op */ }
      finally { setSaveLoading(false); }
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  const activePagePerms   = pagePerms[activeRole]   ?? {};
  const activeTopbarPerms = topbarPerms[activeRole] ?? {};
  const activeOrgPerms    = orgPerms[activeOrgRole] ?? {};

  const showSave = section === 'trackvee' ? canEdit : canEditOrg;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? '#dc2626' : 'var(--text2)', background: 'none',
    borderBottom: `2px solid ${active ? '#dc2626' : 'transparent'}`, transition: 'all 0.15s',
  });

  return (
    <div>
      <PageHeader
        title="Role Access"
        action={showSave ? (
          <button onClick={handleSave} disabled={saveLoading}
            style={{ padding: '6px 16px', background: saved ? '#16a34a' : '#dc2626', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: saveLoading ? 'not-allowed' : 'pointer', opacity: saveLoading ? 0.7 : 1, transition: 'background 0.2s' }}>
            {saveLoading ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        ) : undefined}
      />

      {/* Section Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        <button style={tabStyle(section === 'trackvee')} onClick={() => setSection('trackvee')}>Trackvee Roles</button>
        <button style={tabStyle(section === 'client')}   onClick={() => setSection('client')}>Client Portal Roles</button>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 150px)' }}>

        {/* ── TRACKVEE SECTION ── */}
        {section === 'trackvee' && (
          <>
            <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
              <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>Internal Roles</div>
              {INTERNAL_ROLES.map(role => {
                const on      = activeRole === role;
                const locked  = role === 'super_admin';
                const editable = canManageRole(currentRole, role);
                return (
                  <button key={role} onClick={() => setActiveRole(role)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', border: 0, textAlign: 'left', cursor: 'pointer', background: on ? 'rgba(220,38,38,0.06)' : 'transparent', borderLeft: `3px solid ${on ? '#dc2626' : 'transparent'}`, transition: 'background 0.15s' }}
                    onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--bg2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = on ? 'rgba(220,38,38,0.06)' : 'transparent'; }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: on ? 600 : 400, color: locked ? '#aaa' : on ? '#dc2626' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {locked && <IconLock size={11} />}{ROLE_LABEL[role]}
                      </div>
                      <div style={{ fontSize: 11, color: '#bbb', marginTop: 1 }}>{locked ? 'System — Full Access' : editable ? 'Editable' : 'Read-only'}</div>
                    </div>
                    {on && <IconShield size={13} color={locked ? '#aaa' : '#dc2626'} />}
                  </button>
                );
              })}
              <div style={{ padding: '14px 16px 10px', borderTop: '1px solid var(--border)', marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Your access</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
                  {isSuperAdmin ? 'You can edit all roles except Super Admin.' : currentRole === 'admin' ? 'You can edit Ops, Live Ops, Agent, Chat Support, Viewer.' : 'Read-only view.'}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
              <div style={{ padding: '12px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isLockedRole && <IconLock size={14} color="#aaa" />}{ROLE_LABEL[activeRole]}
                    {isLockedRole && <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400, marginLeft: 4 }}>System Role — Always Full Access</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                    {canEdit ? 'Click cells to toggle permissions. Save when done.' : isLockedRole ? 'Super Admin permissions are fixed.' : 'You do not have permission to edit this role.'}
                  </div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--border)', background: 'var(--bg2)' }}>
                    <th style={{ padding: '9px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6, width: 160 }}>Page</th>
                    {ALL_ACTIONS.map(a => <th key={a} style={{ padding: '9px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: ACTION_COLOR[a], textTransform: 'uppercase', letterSpacing: 0.6, minWidth: 64 }}>{ACTION_LABEL[a]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map(group => {
                    const groupPages = PAGES.filter(p => p.group === group);
                    return (
                      <>
                        <tr key={group} style={{ background: 'var(--bg3)' }}>
                          <td colSpan={5} style={{ padding: '6px 20px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid var(--border)' }}>{group}</td>
                        </tr>
                        {groupPages.map(page => {
                          const allowed = activePagePerms[page.key] ?? [];
                          return (
                            <tr key={page.key} style={{ borderBottom: '1px solid var(--border2)' }}>
                              <td style={{ padding: '9px 20px', color: allowed.length ? 'var(--text)' : 'var(--muted)', fontWeight: allowed.length ? 500 : 400 }}>{page.label}</td>
                              {ALL_ACTIONS.map(action => (
                                <Cell key={action} action={action} on={allowed.includes(action)} na={!page.actions.includes(action)} locked={!canEdit} onClick={() => togglePage(action, page.key)} />
                              ))}
                            </tr>
                          );
                        })}
                      </>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ borderTop: '2px solid var(--border)', marginTop: 4 }}>
                <div style={{ padding: '12px 20px 0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>Topbar Features</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid var(--border)', background: 'var(--bg2)' }}>
                      <th style={{ padding: '9px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6, width: 160 }}>Feature</th>
                      {ALL_ACTIONS.map(a => <th key={a} style={{ padding: '9px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: ACTION_COLOR[a], textTransform: 'uppercase', letterSpacing: 0.6, minWidth: 64 }}>{ACTION_LABEL[a]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {TOPBAR_ROWS.map(feat => {
                      const allowed = activeTopbarPerms[feat.key] ?? [];
                      return (
                        <tr key={feat.key} style={{ borderBottom: '1px solid var(--border2)' }}>
                          <td style={{ padding: '9px 20px', color: allowed.length ? 'var(--text)' : 'var(--muted)', fontWeight: allowed.length ? 500 : 400 }}>{feat.label}</td>
                          {ALL_ACTIONS.map(action => (
                            <Cell key={action} action={action} on={allowed.includes(action)} locked={!canEdit} onClick={() => toggleTopbar(action, feat.key)} />
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
                <IconShield size={12} color="#dc2626" />
                Internal roles have no organization — they see all data globally. Granting Add/Edit/Delete auto-grants View.
              </div>
            </div>
          </>
        )}

        {/* ── CLIENT PORTAL SECTION ── */}
        {section === 'client' && (
          <>
            <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
              <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>B2B Roles</div>
              {(['org_owner', 'org_admin'] as UserRole[]).map(role => {
                const on     = activeOrgRole === role;
                const locked = role === 'org_owner';
                return (
                  <button key={role} onClick={() => setActiveOrgRole(role)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', border: 0, textAlign: 'left', cursor: 'pointer', background: on ? 'rgba(220,38,38,0.06)' : 'transparent', borderLeft: `3px solid ${on ? '#dc2626' : 'transparent'}`, transition: 'background 0.15s' }}
                    onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--bg2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = on ? 'rgba(220,38,38,0.06)' : 'transparent'; }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: on ? 600 : 400, color: locked ? '#aaa' : on ? '#dc2626' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {locked && <IconLock size={11} />}{ORG_ROLE_LABEL[role]}
                      </div>
                      <div style={{ fontSize: 11, color: '#bbb', marginTop: 1 }}>
                        {locked ? 'Full access (system)' : isSuperAdmin ? 'Editable' : 'Read-only'}
                      </div>
                    </div>
                    {on && <IconShield size={13} color={locked ? '#aaa' : '#dc2626'} />}
                  </button>
                );
              })}
              <div style={{ padding: '10px 16px 6px', borderTop: '1px solid var(--border)', marginTop: 8, fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>B2C Individual</div>
              <div style={{ padding: '6px 16px 10px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <IconLock size={11} />Customer
                </div>
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 3, lineHeight: 1.5 }}>
                  Fixed access: Dashboard, Map, Vehicles, Alerts, Geofences, POIs (view only). Cannot add team members.
                </div>
              </div>
              <div style={{ padding: '10px 16px 10px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
                  Org Owner always has full access. Org Admin permissions are configurable.
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
              <div style={{ padding: '12px 20px 10px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isOrgOwner && <IconLock size={14} color="#aaa" />}
                  {ORG_ROLE_LABEL[activeOrgRole]}
                  {isOrgOwner && <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400, marginLeft: 4 }}>Always Full Access</span>}
                </div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                  {canEditOrg ? 'Click cells to toggle portal permissions. Save when done.' : isOrgOwner ? 'Org Owner has full portal access and cannot be restricted.' : 'Only Super Admin can edit client portal permissions.'}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--border)', background: 'var(--bg2)' }}>
                    <th style={{ padding: '9px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6, width: 160 }}>Page</th>
                    {ALL_ACTIONS.map(a => <th key={a} style={{ padding: '9px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: ACTION_COLOR[a], textTransform: 'uppercase', letterSpacing: 0.6, minWidth: 64 }}>{ACTION_LABEL[a]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ORG_GROUPS.map(group => {
                    const groupPages = ORG_PAGES.filter(p => p.group === group);
                    return (
                      <>
                        <tr key={group} style={{ background: 'var(--bg3)' }}>
                          <td colSpan={5} style={{ padding: '6px 20px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid var(--border)' }}>{group}</td>
                        </tr>
                        {groupPages.map(page => {
                          const allowed = isOrgOwner ? page.actions : (activeOrgPerms[page.key] ?? []);
                          return (
                            <tr key={page.key} style={{ borderBottom: '1px solid var(--border2)' }}>
                              <td style={{ padding: '9px 20px', color: allowed.length ? 'var(--text)' : 'var(--muted)', fontWeight: allowed.length ? 500 : 400 }}>{page.label}</td>
                              {ALL_ACTIONS.map(action => (
                                <Cell key={action} action={action} on={isOrgOwner ? page.actions.includes(action) : allowed.includes(action)} na={!page.actions.includes(action)} locked={!canEditOrg} onClick={() => toggleOrgPage(action, page.key)} />
                              ))}
                            </tr>
                          );
                        })}
                      </>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
                <IconShield size={12} color="#3b82f6" />
                These are default portal permissions per role. Org User permissions can be overridden per user on the Client Users page.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

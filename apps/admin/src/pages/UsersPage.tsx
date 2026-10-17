import { useEffect, useState, FormEvent } from 'react';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconEye, IconCheck, IconMinus, IconDownload } from '@tabler/icons-react';
import CustomSelect from '../components/CustomSelect';
import type { DateRange } from '../components/DateRangePicker';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import api from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { fmtDate } from '../utils/date';
import { useCityFilter } from '../contexts/CityFilterContext';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import SkeletonTable from '../components/SkeletonTable';
import DateRangePicker from '../components/DateRangePicker';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';

interface User { id: string; displayId: number; email: string; firstName: string | null; lastName: string | null; role: string; cityId: string | null; isActive: boolean; createdAt: string; organizationId: string | null; }
interface Org { id: string; name: string; }
interface Vehicle { id: string; licensePlate: string | null; make: string | null; model: string | null; displayId: number; }

interface OrgPerm {
  vehiclesView: boolean; vehiclesAdd: boolean; vehiclesEdit: boolean; vehiclesDelete: boolean;
  alertsView: boolean; alertsAdd: boolean; alertsEdit: boolean; alertsDelete: boolean;
  geofencesView: boolean; geofencesAdd: boolean; geofencesEdit: boolean; geofencesDelete: boolean;
  poisView: boolean; poisAdd: boolean; poisEdit: boolean; poisDelete: boolean;
  vehicleIds: string[] | null;
}

const DEFAULT_PERM: OrgPerm = {
  vehiclesView: true, vehiclesAdd: false, vehiclesEdit: false, vehiclesDelete: false,
  alertsView: true, alertsAdd: true, alertsEdit: true, alertsDelete: false,
  geofencesView: true, geofencesAdd: true, geofencesEdit: true, geofencesDelete: false,
  poisView: true, poisAdd: true, poisEdit: true, poisDelete: false,
  vehicleIds: null,
};

const MODULES = [
  { key: 'vehicles',  label: 'Vehicles' },
  { key: 'alerts',    label: 'Alerts' },
  { key: 'geofences', label: 'Geofences' },
  { key: 'pois',      label: 'POIs' },
] as const;

type ModuleKey = typeof MODULES[number]['key'];
type PermAction = 'View' | 'Add' | 'Edit' | 'Delete';
const ACTIONS: PermAction[] = ['View', 'Add', 'Edit', 'Delete'];
const ACTION_COLOR: Record<PermAction, string> = { View: '#3b82f6', Add: '#16a34a', Edit: '#f59e0b', Delete: '#dc2626' };

function permKey(mod: ModuleKey, action: PermAction): keyof OrgPerm {
  return `${mod}${action}` as keyof OrgPerm;
}

const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin',
  ops: 'Ops', live_ops: 'Live Ops', agent: 'Agent', chat_support: 'Chat Support', viewer: 'Viewer',
  client_owner: 'Client Owner', client_super_admin: 'Client Super Admin', client_admin: 'Client Admin', client_user: 'Client User',
};
const sel: React.CSSProperties = { height: 34, padding: '0 8px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer' };
const inp: React.CSSProperties = { height: 34, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12, color: 'var(--input-color)', outline: 'none', background: 'var(--input-bg)', width: 180 };
const empty = { firstName: '', lastName: '', email: '', password: '', role: 'client_super_admin', cityId: '', isActive: true, organizationId: '' };

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [modal, setModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'permissions'>('profile');
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(empty);
  const [perm, setPerm] = useState<OrgPerm>(DEFAULT_PERM);
  const [orgVehicles, setOrgVehicles] = useState<Vehicle[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState(false);
  const { cities, selectedCityId } = useCityFilter();

  const load = () => {
    const p = selectedCityId ? `?cityId=${selectedCityId}` : '';
    Promise.all([api.get<User[]>(`/users${p}`), api.get<Org[]>('/organizations')])
      .then(([u, o]) => { setUsers(u.data.filter(x => !x.role.startsWith('client_'))); setOrgs(o.data); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [selectedCityId]);

  // Load org vehicles when org changes and role is org_user
  useEffect(() => {
    if (form.role === 'client_admin' && form.organizationId) {
      api.get<Vehicle[]>(`/vehicles?organizationId=${form.organizationId}`)
        .then(r => setOrgVehicles(r.data)).catch(() => setOrgVehicles([]));
    } else {
      setOrgVehicles([]);
    }
  }, [form.role, form.organizationId]);

  const openAdd = () => { setEditing(null); setForm(empty); setPerm(DEFAULT_PERM); setActiveTab('profile'); setModal(true); };
  const openEdit = async (u: User) => {
    setEditing(u);
    setForm({ firstName: u.firstName ?? '', lastName: u.lastName ?? '', email: u.email, password: '', role: u.role, cityId: u.cityId ?? '', isActive: u.isActive, organizationId: u.organizationId ?? '' });
    setActiveTab('profile');
    if (u.role === 'client_admin') {
      try {
        const r = await api.get<OrgPerm>(`/org-permissions/${u.id}`);
        setPerm(r.data ?? DEFAULT_PERM);
      } catch { setPerm(DEFAULT_PERM); }
    } else {
      setPerm(DEFAULT_PERM);
    }
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); };

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const togglePerm = (key: keyof OrgPerm) => {
    setPerm(p => {
      const newVal = !p[key];
      const updated = { ...p, [key]: newVal };
      // granting Add/Edit/Delete auto-grants View
      if (newVal && (key.endsWith('Add') || key.endsWith('Edit') || key.endsWith('Delete'))) {
        const modKey = key.replace(/(Add|Edit|Delete)$/, '') as ModuleKey;
        const viewKey = `${modKey}View` as keyof OrgPerm;
        updated[viewKey] = true as never;
      }
      return updated;
    });
  };

  const toggleVehicle = (id: string) => {
    setPerm(p => {
      const cur = p.vehicleIds ?? [];
      return { ...p, vehicleIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form, organizationId: form.organizationId || null, cityId: form.cityId || null };
      if (!payload.password) delete payload.password;
      let userId = editing?.id;
      if (editing) await api.patch(`/users/${editing.id}`, payload);
      else {
        const r = await api.post<{ id: string }>('/users', payload);
        userId = r.data.id;
      }
      if (form.role === 'client_admin' && userId && form.organizationId) {
        await api.put(`/org-permissions/${userId}`, { ...perm, orgId: form.organizationId });
      }
      await load(); closeModal();
      toast(editing ? 'User updated' : 'User added');
    } catch { toast('Failed to save user', 'error'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(true);
    try {
      await api.delete(`/users/${deleting.id}`);
      setUsers(u => u.filter(x => x.id !== deleting.id));
      setDeleting(null);
      toast('User deleted');
    } catch { toast('Failed to delete user', 'error'); } finally { setDeletingId(false); }
  };

  const filtered = users.filter(u => {
    if (q && !u.email.toLowerCase().includes(q.toLowerCase()) && !(u.firstName ?? '').toLowerCase().includes(q.toLowerCase())) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter && String(u.isActive) !== statusFilter) return false;
    if (dateRange?.from && !isWithinInterval(parseISO(u.createdAt), { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to ?? dateRange.from) })) return false;
    return true;
  });

  const exportCSV = () => {
    const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Role', 'Status', 'City', 'Joined'];
    const csvRows = filtered.map(u => [u.displayId, u.firstName ?? '', u.lastName ?? '', u.email, roleLabel[u.role] ?? u.role, u.isActive ? 'Active' : 'Inactive', u.cityId ?? '', fmtDate(u.createdAt)]);
    const csv = [headers, ...csvRows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `users-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const isOrgUser = form.role === 'client_admin';
  const tabs: { key: 'profile' | 'permissions'; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    ...(isOrgUser ? [{ key: 'permissions' as const, label: 'Permissions' }] : []),
  ];

  return (
    <div>
      <PageHeader title="Users" count={users.length} action={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #dc2626', borderRadius: 8, background: 'transparent', color: '#dc2626', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <IconDownload size={13} /> Export
          </button>
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <IconPlus size={13} /> Add User
          </button>
        </div>
      } />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email…" style={inp}
            onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
        </div>
        <CustomSelect value={roleFilter} onChange={setRoleFilter} options={[
          { value: '', label: 'All Roles' }, { value: 'super_admin', label: 'Super Admin' },
          { value: 'admin', label: 'Admin' }, { value: 'ops', label: 'Ops' },
          { value: 'live_ops', label: 'Live Ops' }, { value: 'agent', label: 'Agent' },
          { value: 'chat_support', label: 'Chat Support' }, { value: 'viewer', label: 'Viewer' },
          { value: 'client_owner', label: 'Client Owner' }, { value: 'client_super_admin', label: 'Client Super Admin' },
          { value: 'client_admin', label: 'Client Admin' }, { value: 'client_user', label: 'Client User' },
        ]} minWidth={150} />
        <CustomSelect value={statusFilter} onChange={setStatusFilter} options={[
          { value: '', label: 'All Status' }, { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' },
        ]} />
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Joined date" />
        {(q || roleFilter || statusFilter || dateRange) && <button onClick={() => { setQ(''); setRoleFilter(''); setStatusFilter(''); setDateRange(undefined); }} style={{ fontSize: 11, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer' }}>Clear all</button>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{filtered.length} results</span>
      </div>

      {loading ? <SkeletonTable cols={7} /> : (
        <div className="tbl-wrap page-table">
        <table>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['ID', 'Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${u.isActive ? '#22c55e' : '#e5e7eb'}` }}>
                <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{u.displayId}</td>
                <td style={{ padding: '10px 14px', fontWeight: 500 }}>{u.firstName || u.lastName ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '—'}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{u.email}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{roleLabel[u.role] ?? u.role}</td>
                <td style={{ padding: '10px 14px', color: u.isActive ? '#16a34a' : 'var(--muted)' }}>{u.isActive ? 'Active' : 'Inactive'}</td>
                <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{fmtDate(u.createdAt)}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => openEdit(u)} title="View / Edit" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEye size={14} /></button>
                    <button onClick={() => openEdit(u)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEdit size={14} /></button>
                    <button onClick={() => setDeleting(u)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconTrash size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No users found</td></tr>}
          </tbody>
        </table>
        </div>
      )}

      <Modal open={modal} title={editing ? 'Edit User' : 'Add User'} onClose={closeModal} width='min(1200px, 97vw)' height='min(800px, 96vh)'>
        {/* Tabs */}
        {isOrgUser && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t.key ? 600 : 400, color: activeTab === t.key ? '#dc2626' : 'var(--muted)', borderBottom: `2px solid ${activeTab === t.key ? '#dc2626' : 'transparent'}`, transition: 'all 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Profile tab */}
          {activeTab === 'profile' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <FormField label="First Name">
                  <input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Bilal" style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
                </FormField>
                <FormField label="Last Name">
                  <input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Mughal" style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
                </FormField>
              </div>
              <FormField label="Email">
                <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="user@example.com" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
              </FormField>
              <FormField label={editing ? 'New Password (leave blank to keep)' : 'Password'}>
                <input type="password" required={!editing} value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <FormField label="Role">
                  <select value={form.role} onChange={e => set('role', e.target.value)} style={selectStyle}>
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="ops">Ops</option>
                    <option value="live_ops">Live Ops</option>
                    <option value="agent">Agent</option>
                    <option value="chat_support">Chat Support</option>
                    <option value="viewer">Viewer</option>
                    <option value="client_owner">Client Owner</option>
                    <option value="client_super_admin">Client Super Admin</option>
                    <option value="client_admin">Client Admin</option>
                    <option value="client_user">Client User</option>
                  </select>
                </FormField>
                <FormField label="Status">
                  <select value={String(form.isActive)} onChange={e => set('isActive', e.target.value === 'true')} style={selectStyle}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </FormField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <FormField label="Organization">
                  <select value={form.organizationId} onChange={e => set('organizationId', e.target.value)} style={selectStyle}>
                    <option value="">None (Internal)</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </FormField>
                <FormField label="City">
                  <select value={form.cityId} onChange={e => set('cityId', e.target.value)} style={selectStyle}>
                    <option value="">— Select City —</option>
                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </FormField>
              </div>
            </>
          )}

          {/* Permissions tab — only for org_user */}
          {activeTab === 'permissions' && (
            <div>
              {/* Module CRUD table */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Module Permissions</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
                    <th style={{ padding: '7px 0', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11 }}>Module</th>
                    {ACTIONS.map(a => (
                      <th key={a} style={{ padding: '7px 8px', textAlign: 'center', color: ACTION_COLOR[a], fontWeight: 700, fontSize: 11, textTransform: 'uppercase', width: 54 }}>{a}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(mod => (
                    <tr key={mod.key} style={{ borderBottom: '1px solid var(--border2)' }}>
                      <td style={{ padding: '8px 0', fontWeight: 500 }}>{mod.label}</td>
                      {ACTIONS.map(action => {
                        const k = permKey(mod.key, action);
                        const on = perm[k] as boolean;
                        return (
                          <td key={action} style={{ padding: '8px 8px', textAlign: 'center' }}>
                            <button type="button" onClick={() => togglePerm(k)}
                              style={{ width: 26, height: 26, borderRadius: 5, border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', margin: '0 auto', background: on ? `${ACTION_COLOR[action]}18` : 'var(--bg3)', color: on ? ACTION_COLOR[action] : '#ccc', transition: 'all 0.15s' }}>
                              {on ? <IconCheck size={12} strokeWidth={2.5} /> : <IconMinus size={12} />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Vehicle access */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Vehicle Access</div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
                  <input type="radio" name="vehicleAccess" checked={perm.vehicleIds === null} onChange={() => setPerm(p => ({ ...p, vehicleIds: null }))}
                    style={{ accentColor: '#dc2626' }} />
                  All org vehicles
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" name="vehicleAccess" checked={perm.vehicleIds !== null} onChange={() => setPerm(p => ({ ...p, vehicleIds: [] }))}
                    style={{ accentColor: '#dc2626' }} />
                  Specific vehicles only
                </label>
              </div>
              {perm.vehicleIds !== null && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 6, maxHeight: 180, overflowY: 'auto', padding: 4 }}>
                  {orgVehicles.length === 0
                    ? <div style={{ padding: '12px 8px', color: '#bbb', fontSize: 12 }}>No vehicles found for this organization</div>
                    : orgVehicles.map(v => {
                        const label = v.licensePlate ?? (`${v.make ?? ''} ${v.model ?? ''}`.trim() || `#${v.displayId}`);
                        const checked = (perm.vehicleIds ?? []).includes(v.id);
                        return (
                          <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', borderRadius: 4, background: checked ? 'rgba(220,38,38,0.05)' : 'transparent' }}
                            onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--bg2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = checked ? 'rgba(220,38,38,0.05)' : 'transparent'; }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleVehicle(v.id)} style={{ accentColor: '#dc2626' }} />
                            <span style={{ fontSize: 12.5, color: checked ? '#dc2626' : 'var(--text)', fontWeight: checked ? 600 : 400 }}>{label}</span>
                          </label>
                        );
                      })
                  }
                </div>
              )}
            </div>
          )}

          <FormActions onClose={closeModal} loading={saving} submitLabel={editing ? 'Update' : 'Create'} />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete User"
        message={`Delete "${deleting?.email}"? This cannot be undone.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />
    </div>
  );
}

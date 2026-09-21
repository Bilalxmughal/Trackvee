import { useEffect, useState, FormEvent } from 'react';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconEye } from '@tabler/icons-react';
import type { DateRange } from '../components/DateRangePicker';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import api from '../api/client';
import { fmtDate } from '../utils/date';
import { useCityFilter } from '../contexts/CityFilterContext';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import DateRangePicker from '../components/DateRangePicker';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';

interface User { id: string; displayId: number; email: string; firstName: string | null; lastName: string | null; role: string; cityId: string | null; isActive: boolean; createdAt: string; organizationId: string | null; }
interface Org { id: string; name: string; }

const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin',
  ops: 'Ops', live_ops: 'Live Ops', agent: 'Agent', chat_support: 'Chat Support', viewer: 'Viewer',
  org_owner: 'Org Owner', org_admin: 'Org Admin', org_user: 'Org User', customer: 'Customer',
};
const sel: React.CSSProperties = { height: 30, padding: '0 8px', border: '1px solid var(--input-border)', borderRadius: 3, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer' };
const inp: React.CSSProperties = { height: 30, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 3, fontSize: 12, color: 'var(--input-color)', outline: 'none', background: 'var(--input-bg)', width: 180 };
const empty = { firstName: '', lastName: '', email: '', password: '', role: 'org_admin', cityId: '', isActive: true, organizationId: '' };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState(false);
  const { cities, selectedCityId } = useCityFilter();

  const load = () => {
    const p = selectedCityId ? `?cityId=${selectedCityId}` : '';
    Promise.all([api.get<User[]>(`/users${p}`), api.get<Org[]>('/organizations')])
      .then(([u, o]) => { setUsers(u.data.filter(x => x.role !== 'customer')); setOrgs(o.data); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [selectedCityId]);

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ firstName: u.firstName ?? '', lastName: u.lastName ?? '', email: u.email, password: '', role: u.role, cityId: u.cityId ?? '', isActive: u.isActive, organizationId: u.organizationId ?? '' });
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); };

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form, organizationId: form.organizationId || null, cityId: form.cityId || null };
      if (!payload.password) delete payload.password;
      if (editing) await api.patch(`/users/${editing.id}`, payload);
      else await api.post('/users', payload);
      await load(); closeModal();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(true);
    try {
      await api.delete(`/users/${deleting.id}`);
      setUsers(u => u.filter(x => x.id !== deleting.id));
      setDeleting(null);
    } catch { } finally { setDeletingId(false); }
  };

  const filtered = users.filter(u => {
    if (q && !u.email.toLowerCase().includes(q.toLowerCase()) && !(u.firstName ?? '').toLowerCase().includes(q.toLowerCase())) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter && String(u.isActive) !== statusFilter) return false;
    if (dateRange?.from && !isWithinInterval(parseISO(u.createdAt), { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to ?? dateRange.from) })) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Users" count={users.length} action={
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          <IconPlus size={13} /> Add User
        </button>
      } />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email…" style={inp}
            onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={sel}>
          <option value="">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="ops">Ops</option>
          <option value="live_ops">Live Ops</option>
          <option value="agent">Agent</option>
          <option value="chat_support">Chat Support</option>
          <option value="viewer">Viewer</option>
          <option value="org_owner">Org Owner</option>
          <option value="org_admin">Org Admin</option>
          <option value="org_user">Org User</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="">All Status</option><option value="true">Active</option><option value="false">Inactive</option>
        </select>
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Joined date" />
        {(q || roleFilter || statusFilter || dateRange) && <button onClick={() => { setQ(''); setRoleFilter(''); setStatusFilter(''); setDateRange(undefined); }} style={{ fontSize: 11, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer' }}>Clear all</button>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{filtered.length} results</span>
      </div>

      {loading ? <Spinner /> : (
        <div className="tbl-wrap">
        <table>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['ID', 'Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#aaa', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${u.isActive ? '#22c55e' : '#e5e7eb'}` }}>
                <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{u.displayId}</td>
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{u.firstName || u.lastName ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '—'}</td>
                <td style={{ padding: '10px 16px', color: 'var(--text2)' }}>{u.email}</td>
                <td style={{ padding: '10px 16px', color: 'var(--text2)' }}>{roleLabel[u.role] ?? u.role}</td>
                <td style={{ padding: '10px 16px', color: u.isActive ? '#16a34a' : 'var(--muted)' }}>{u.isActive ? 'Active' : 'Inactive'}</td>
                <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{fmtDate(u.createdAt)}</td>
                <td style={{ padding: '10px 16px' }}>
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

      <Modal open={modal} title={editing ? 'Edit User' : 'Add User'} onClose={closeModal}>
        <form onSubmit={handleSubmit}>
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
                <option value="org_owner">Org Owner</option>
                <option value="org_admin">Org Admin</option>
                <option value="org_user">Org User</option>
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
                <option value="">None (Super Admin)</option>
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
          <FormActions onClose={closeModal} loading={saving} submitLabel={editing ? 'Update' : 'Create'} />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete User"
        message={`Delete "${deleting?.email}"? This cannot be undone.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />
    </div>
  );
}

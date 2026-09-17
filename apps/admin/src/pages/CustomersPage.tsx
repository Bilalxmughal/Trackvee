import { useEffect, useState, FormEvent } from 'react';
import { IconPlus, IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';

interface Customer { id: string; displayId: number; email: string; firstName: string | null; lastName: string | null; isActive: boolean; createdAt: string; organizationId: string | null; }
interface Org { id: string; name: string; }

const inp: React.CSSProperties = { height: 34, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12.5, color: 'var(--input-color)', outline: 'none', background: 'var(--input-bg)', width: 200 };
const sel: React.CSSProperties = { height: 34, padding: '0 10px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12.5, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer' };
const empty = { firstName: '', lastName: '', email: '', password: '', contactNo: '', isActive: true, organizationId: '' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [deletingId, setDeletingId] = useState(false);

  const load = () => {
    Promise.all([
      api.get<Customer[]>('/users?role=customer'),
      api.get<Org[]>('/organizations'),
    ]).then(([u, o]) => { setCustomers(u.data); setOrgs(o.data); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ firstName: c.firstName ?? '', lastName: c.lastName ?? '', email: c.email, password: '', contactNo: '', isActive: c.isActive, organizationId: c.organizationId ?? '' });
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); };
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form, role: 'customer', organizationId: form.organizationId || null };
      if (!payload.password) delete payload.password;
      if (editing) await api.patch(`/users/${editing.id}`, payload);
      else await api.post('/users', payload);
      await load(); closeModal();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return; setDeletingId(true);
    try {
      await api.delete(`/users/${deleting.id}`);
      setCustomers(c => c.filter(x => x.id !== deleting.id)); setDeleting(null);
    } catch { } finally { setDeletingId(false); }
  };

  const filtered = customers.filter(c => {
    if (q && !c.email.toLowerCase().includes(q.toLowerCase()) && !(c.firstName ?? '').toLowerCase().includes(q.toLowerCase()) && !(c.lastName ?? '').toLowerCase().includes(q.toLowerCase())) return false;
    if (statusFilter && String(c.isActive) !== statusFilter) return false;
    return true;
  });

  const orgName = (id: string | null) => orgs.find(o => o.id === id)?.name ?? '—';

  return (
    <div>
      <PageHeader title="Customers" count={customers.length} action={
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
          <IconPlus size={13} /> Add Customer
        </button>
      } />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid #f5f5f5', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name or email…" style={inp}
            onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="">All Status</option><option value="true">Active</option><option value="false">Inactive</option>
        </select>
        {(q || statusFilter) && (
          <button onClick={() => { setQ(''); setStatusFilter(''); }} style={{ fontSize: 11.5, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer' }}>Clear all</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{filtered.length} results</span>
      </div>

      {loading ? <Spinner /> : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                {['ID', 'Name', 'Email', 'Client', 'Status', 'Joined', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f8f8f8', borderLeft: `3px solid ${c.isActive ? '#22c55e' : '#e5e7eb'}` }}>
                  <td style={{ padding: '11px 16px', color: '#aaa' }}>#{c.displayId}</td>
                  <td style={{ padding: '11px 16px', fontWeight: 500 }}>
                    {c.firstName || c.lastName ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() : '—'}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#555' }}>{c.email}</td>
                  <td style={{ padding: '11px 16px', color: '#555' }}>{orgName(c.organizationId)}</td>
                  <td style={{ padding: '11px 16px', color: c.isActive ? '#16a34a' : '#aaa' }}>{c.isActive ? 'Active' : 'Inactive'}</td>
                  <td style={{ padding: '11px 16px', color: '#aaa' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEdit size={14} /></button>
                      <button onClick={() => setDeleting(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconTrash size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No customers found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} title={editing ? 'Edit Customer' : 'Add Customer'} onClose={closeModal}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="First Name">
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Ali" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
            </FormField>
            <FormField label="Last Name">
              <input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Hassan" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
            </FormField>
          </div>
          <FormField label="Email *">
            <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="customer@example.com" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
          </FormField>
          <FormField label={editing ? 'New Password (leave blank to keep)' : 'Password *'}>
            <input type="password" required={!editing} value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Client (Organization)">
              <select value={form.organizationId} onChange={e => set('organizationId', e.target.value)} style={selectStyle}>
                <option value="">None</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select value={String(form.isActive)} onChange={e => set('isActive', e.target.value === 'true')} style={selectStyle}>
                <option value="true">Active</option><option value="false">Inactive</option>
              </select>
            </FormField>
          </div>
          <FormActions onClose={closeModal} loading={saving} submitLabel={editing ? 'Update' : 'Add Customer'} />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete Customer"
        message={`Delete customer "${deleting?.email}"? This cannot be undone.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />
    </div>
  );
}

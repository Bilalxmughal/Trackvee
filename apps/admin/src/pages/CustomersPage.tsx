import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconEye } from '@tabler/icons-react';
import api from '../api/client';
import SkeletonTable from '../components/SkeletonTable';
import { fmtDate } from '../utils/date';
import { useCityFilter } from '../contexts/CityFilterContext';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';

interface Customer {
  id: string; displayId: number; name: string;
  pocName: string | null; contactNo: string | null; email: string | null;
  cityId: string | null; isActive: boolean; createdAt: string;
  vehicleCount: number;
}

const inp: React.CSSProperties = { height: 34, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12.5, color: 'var(--input-color)', outline: 'none', background: 'var(--input-bg)', width: 200 };
const sel: React.CSSProperties = { height: 34, padding: '0 10px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12.5, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer' };
const empty = { name: '', contactNo: '', email: '', password: '', cityId: '', isActive: true };

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { cities, selectedCityId } = useCityFilter();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [deletingId, setDeletingId] = useState(false);

  const load = () => {
    const params = new URLSearchParams({ type: 'b2c' });
    if (selectedCityId) params.set('cityId', selectedCityId);
    api.get<Customer[]>(`/organizations?${params}`)
      .then(r => setCustomers(r.data))
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [selectedCityId]);

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, contactNo: c.contactNo ?? '', email: c.email ?? '', password: '', cityId: c.cityId ?? '', isActive: c.isActive });
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); };
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        contactNo: form.contactNo || null,
        email: form.email || null,
        cityId: form.cityId || null,
        isActive: form.isActive,
      };
      if (form.password) payload.password = form.password;
      if (editing) await api.patch(`/organizations/${editing.id}`, payload);
      else await api.post('/organizations', { ...payload, type: 'b2c' });
      await load(); closeModal();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return; setDeletingId(true);
    try {
      await api.delete(`/organizations/${deleting.id}`);
      setCustomers(c => c.filter(x => x.id !== deleting.id)); setDeleting(null);
    } catch { } finally { setDeletingId(false); }
  };

  const cityName = (id: string | null) => cities.find(c => c.id === id)?.name ?? '—';

  const filtered = customers.filter(c => {
    if (q && !c.name.toLowerCase().includes(q.toLowerCase()) && !(c.email ?? '').toLowerCase().includes(q.toLowerCase())) return false;
    if (statusFilter && String(c.isActive) !== statusFilter) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Customers" count={customers.length} action={
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
          <IconPlus size={13} /> Add Customer
        </button>
      } />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
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

      {loading ? <SkeletonTable cols={9} /> : (
        <div className="tbl-wrap page-table">
          <table>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['ID', 'Name', 'Contact', 'Email', 'City', 'Vehicles', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${c.isActive ? '#22c55e' : '#e5e7eb'}` }}>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{c.displayId}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{c.contactNo ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{c.email ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{cityName(c.cityId)}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)', textAlign: 'center' }}>{c.vehicleCount}</td>
                  <td style={{ padding: '10px 14px', color: c.isActive ? '#16a34a' : 'var(--muted)' }}>{c.isActive ? 'Active' : 'Inactive'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{fmtDate(c.createdAt)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button onClick={() => navigate(`/customers/${c.id}`)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEye size={14} /></button>
                      <button onClick={() => openEdit(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEdit size={14} /></button>
                      <button onClick={() => setDeleting(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconTrash size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No customers found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} title={editing ? 'Edit Customer' : 'Add Customer'} onClose={closeModal}>
        <form onSubmit={handleSubmit}>
          <FormField label="Full Name *">
            <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ali Hassan" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Email">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="customer@example.com" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
            </FormField>
            <FormField label="Phone">
              <input value={form.contactNo} onChange={e => set('contactNo', e.target.value)} placeholder="+92 300 0000000" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
            </FormField>
          </div>
          <FormField label={editing ? 'New Password (leave blank to keep)' : 'Password'}>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="City">
              <select value={form.cityId} onChange={e => set('cityId', e.target.value)} style={selectStyle}>
                <option value="">— Select City —</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
        message={`Delete customer "${deleting?.name}"? This cannot be undone.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />
    </div>
  );
}

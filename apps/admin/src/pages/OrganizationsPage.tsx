import { useEffect, useState, FormEvent } from 'react';
import { IconPlus, IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import type { DateRange } from '../components/DateRangePicker';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import SkeletonTable from '../components/SkeletonTable';
import DateRangePicker from '../components/DateRangePicker';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';

interface Org { id: string; displayId: number; name: string; isActive: boolean; createdAt: string; }

const sel: React.CSSProperties = { height: 30, padding: '0 8px', border: '1px solid #e8e8e8', borderRadius: 3, fontSize: 12, color: '#555', background: '#fff', outline: 'none', cursor: 'pointer' };
const inp: React.CSSProperties = { height: 30, padding: '0 10px 0 30px', border: '1px solid #e8e8e8', borderRadius: 3, fontSize: 12, color: '#111', outline: 'none', background: '#fff', width: 180 };

const empty = { name: '', isActive: true };

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Org | null>(null);
  const [form, setForm] = useState<{ name: string; isActive: boolean }>(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Org | null>(null);
  const [deletingId, setDeletingId] = useState(false);

  const load = () => api.get<Org[]>('/organizations').then(r => setOrgs(r.data)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (o: Org) => { setEditing(o); setForm({ name: o.name, isActive: o.isActive }); setModal(true); };
  const closeModal = () => { setModal(false); setEditing(null); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.patch(`/organizations/${editing.id}`, form);
      else await api.post('/organizations', form);
      await load();
      closeModal();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(true);
    try {
      await api.delete(`/organizations/${deleting.id}`);
      setOrgs(o => o.filter(x => x.id !== deleting.id));
      setDeleting(null);
    } catch { } finally { setDeletingId(false); }
  };

  const filtered = orgs.filter(o => {
    if (q && !o.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (statusFilter && String(o.isActive) !== statusFilter) return false;
    if (dateRange?.from) {
      if (!isWithinInterval(parseISO(o.createdAt), { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to ?? dateRange.from) })) return false;
    }
    return true;
  });

  return (
    <div>
      <PageHeader title="Organizations" count={orgs.length} action={
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          <IconPlus size={13} /> Add Org
        </button>
      } />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid #f5f5f5', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" style={inp}
            onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="">All Status</option><option value="true">Active</option><option value="false">Inactive</option>
        </select>
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Created date" />
        {(q || statusFilter || dateRange) && <button onClick={() => { setQ(''); setStatusFilter(''); setDateRange(undefined); }} style={{ fontSize: 11, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer' }}>Clear all</button>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{filtered.length} results</span>
      </div>

      {loading ? <SkeletonTable cols={5} /> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              {['ID', 'Name', 'Status', 'Created', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#aaa', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid #f8f8f8', borderLeft: `3px solid ${o.isActive ? '#22c55e' : '#e5e7eb'}` }}>
                <td style={{ padding: '10px 16px', color: '#aaa' }}>#{o.displayId}</td>
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{o.name}</td>
                <td style={{ padding: '10px 16px', color: o.isActive ? '#16a34a' : '#aaa' }}>{o.isActive ? 'Active' : 'Inactive'}</td>
                <td style={{ padding: '10px 16px', color: '#aaa' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openEdit(o)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEdit size={14} /></button>
                    <button onClick={() => setDeleting(o)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconTrash size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No organizations found</td></tr>}
          </tbody>
        </table>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modal} title={editing ? 'Edit Organization' : 'Add Organization'} onClose={closeModal}>
        <form onSubmit={handleSubmit}>
          <FormField label="Organization Name">
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Acme Logistics" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
          </FormField>
          <FormField label="Status">
            <select value={String(form.isActive)} onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))} style={selectStyle}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </FormField>
          <FormActions onClose={closeModal} loading={saving} submitLabel={editing ? 'Update' : 'Create'} />
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog open={!!deleting} title="Delete Organization"
        message={`Are you sure you want to delete "${deleting?.name}"? This cannot be undone.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />
    </div>
  );
}

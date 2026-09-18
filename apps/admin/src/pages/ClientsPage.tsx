import { useEffect, useState, FormEvent } from 'react';
import { IconPlus, IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
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

interface Client { id: string; displayId: number; name: string; companyName: string | null; pocName: string | null; cityId: string | null; isActive: boolean; createdAt: string; }

const sel: React.CSSProperties = { height: 34, padding: '0 10px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12.5, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer' };
const inp: React.CSSProperties = { height: 34, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12.5, color: 'var(--input-color)', outline: 'none', background: 'var(--input-bg)', width: 200 };
const empty = { name: '', companyName: '', pocName: '', cityId: '', isActive: true };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<{ name: string; companyName: string; pocName: string; cityId: string; isActive: boolean }>(empty);
  const { cities, selectedCityId } = useCityFilter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState(false);

  const load = () => api.get<Client[]>('/organizations').then(r => setClients(r.data)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (c: Client) => { setEditing(c); setForm({ name: c.name, companyName: c.companyName ?? '', pocName: c.pocName ?? '', cityId: c.cityId ?? '', isActive: c.isActive }); setModal(true); };
  const closeModal = () => { setModal(false); setEditing(null); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, companyName: form.companyName || null, pocName: form.pocName || null, cityId: form.cityId || null };
      if (editing) await api.patch(`/organizations/${editing.id}`, payload);
      else await api.post('/organizations', payload);
      await load(); closeModal();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return; setDeletingId(true);
    try {
      await api.delete(`/organizations/${deleting.id}`);
      setClients(c => c.filter(x => x.id !== deleting.id)); setDeleting(null);
    } catch { } finally { setDeletingId(false); }
  };

  const filtered = clients.filter(c => {
    if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (statusFilter && String(c.isActive) !== statusFilter) return false;
    if (selectedCityId && c.cityId !== selectedCityId) return false;
    if (dateRange?.from && !isWithinInterval(parseISO(c.createdAt), { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to ?? dateRange.from) })) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Clients" count={clients.length} action={
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
          <IconPlus size={13} /> Add Client
        </button>
      } />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search clients…" style={inp}
            onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="">All Status</option><option value="true">Active</option><option value="false">Inactive</option>
        </select>
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Created date" />
        {(q || statusFilter || dateRange) && (
          <button onClick={() => { setQ(''); setStatusFilter(''); setDateRange(undefined); }} style={{ fontSize: 11.5, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#555')}
            onMouseLeave={e => (e.currentTarget.style.color = '#aaa')}>
            Clear all
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{filtered.length} results</span>
      </div>

      {loading ? <Spinner /> : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['ID', 'Name', 'Company Name', 'POC Name', 'Status', 'Created', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${c.isActive ? '#22c55e' : '#e5e7eb'}` }}>
                  <td style={{ padding: '11px 16px', color: 'var(--muted)' }}>{c.displayId}</td>
                  <td style={{ padding: '11px 16px', fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: '11px 16px', color: 'var(--text2)' }}>{c.companyName ?? '—'}</td>
                  <td style={{ padding: '11px 16px', color: 'var(--text2)' }}>{c.pocName ?? '—'}</td>
                  <td style={{ padding: '11px 16px', color: c.isActive ? '#16a34a' : 'var(--muted)' }}>{c.isActive ? 'Active' : 'Inactive'}</td>
                  <td style={{ padding: '11px 16px', color: 'var(--muted)' }}>{fmtDate(c.createdAt)}</td>
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
              {!filtered.length && <tr><td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No clients found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} title={editing ? 'Edit Client' : 'Add Client'} onClose={closeModal}>
        <form onSubmit={handleSubmit}>
          <FormField label="Client Name *">
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Acme Logistics" style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Company Name">
              <input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                placeholder="e.g. Acme Inc." style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
            </FormField>
            <FormField label="POC Name">
              <input value={form.pocName} onChange={e => setForm(f => ({ ...f, pocName: e.target.value }))}
                placeholder="e.g. Ali Khan" style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="City">
              <select value={form.cityId} onChange={e => setForm(f => ({ ...f, cityId: e.target.value }))} style={selectStyle}>
                <option value="">— Select City —</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select value={String(form.isActive)} onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))} style={selectStyle}>
                <option value="true">Active</option><option value="false">Inactive</option>
              </select>
            </FormField>
          </div>
          <FormActions onClose={closeModal} loading={saving} submitLabel={editing ? 'Update' : 'Create'} />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete Client"
        message={`Delete client "${deleting?.name}"? This cannot be undone.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />
    </div>
  );
}

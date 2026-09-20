import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconEye, IconEyeOff, IconDownload } from '@tabler/icons-react';
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

interface Client {
  id: string; displayId: number; name: string; type: string;
  companyName: string | null; pocName: string | null;
  contactNo: string | null; email: string | null;
  cityId: string | null; isActive: boolean; createdAt: string;
  vehicleCount: number; deviceCount: number;
}
interface Vehicle { id: string; licensePlate: string | null; organizationId: string | null; }

const sel: React.CSSProperties = { height: 34, padding: '0 10px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12.5, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer' };
const inp: React.CSSProperties = { height: 34, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12.5, color: 'var(--input-color)', outline: 'none', background: 'var(--input-bg)', width: 200 };

const typeTag = (t: string) => (
  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{t === 'b2b' ? 'B2B' : 'B2C'}</span>
);

const empty = { name: '', companyName: '', contactNo: '92', email: '', password: '', cityId: '', isActive: true, type: 'b2b' };

function handlePhone(val: string, set: (k: string, v: unknown) => void) {
  let d = val.replace(/\D/g, '');
  if (!d.startsWith('92')) d = '92' + d.replace(/^9?2?/, '');
  if (d.length > 12) d = d.slice(0, 12);
  set('contactNo', d);
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [plateMap, setPlateMap] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(empty);
  const [showPw, setShowPw] = useState(false);
  const { cities, selectedCityId } = useCityFilter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const exportCSV = () => {
    const cityName = (id: string | null) => cities.find(c => c.id === id)?.name ?? '';
    const rows = [
      ['ID', 'Name', 'Company', 'Contact', 'Email', 'Type', 'City', 'Vehicles', 'Devices', 'Status', 'Added'],
      ...filtered.map(c => [
        c.displayId, c.name, c.companyName ?? '', c.contactNo ?? '',
        c.email ?? '', c.type.toUpperCase(), cityName(c.cityId),
        c.vehicleCount, c.deviceCount, c.isActive ? 'Active' : 'Inactive', fmtDate(c.createdAt),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'clients.csv' });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const load = () => {
    const params = new URLSearchParams();
    if (selectedCityId) params.set('cityId', selectedCityId);
    Promise.all([
      api.get<Client[]>(`/organizations?${params}`),
      api.get<Vehicle[]>('/vehicles'),
    ]).then(([orgs, vs]) => {
      setClients(orgs.data);
      const map = new Map<string, string[]>();
      vs.data.forEach(v => {
        if (!v.organizationId || !v.licensePlate) return;
        const arr = map.get(v.organizationId) ?? [];
        arr.push(v.licensePlate);
        map.set(v.organizationId, arr);
      });
      setPlateMap(map);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [selectedCityId]);

  const openAdd = () => { setEditing(null); setForm(empty); setShowPw(false); setModal(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    const phone = c.contactNo ? c.contactNo.replace(/\D/g, '') : '92';
    setForm({ name: c.name, companyName: c.companyName ?? '', contactNo: phone.startsWith('92') ? phone : '92' + phone, email: c.email ?? '', password: '', cityId: c.cityId ?? '', isActive: c.isActive, type: c.type });
    setShowPw(false); setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); setPhoneError(''); };
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.contactNo && form.contactNo.length !== 12) { setPhoneError('12 digits required (92XXXXXXXXXX)'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        companyName: form.type === 'b2b' ? (form.companyName || null) : null,
        contactNo: form.contactNo || null,
        email: form.email || null,
        cityId: form.cityId || null,
        isActive: form.isActive,
        type: form.type,
      };
      if (form.password) payload.password = form.password;
      if (editing) await api.patch(`/organizations/${editing.id}`, payload);
      else await api.post('/organizations', payload);
      await load(); closeModal();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return; setDeletingId(true);
    try {
      await api.delete(`/organizations/${deleting.id}`);
      setClients(cs => cs.filter(x => x.id !== deleting.id)); setDeleting(null);
    } catch { } finally { setDeletingId(false); }
  };

  const filtered = clients.filter(c => {
    if (q) {
      const lq = q.toLowerCase();
      const match = c.name.toLowerCase().includes(lq)
        || (c.companyName ?? '').toLowerCase().includes(lq)
        || (c.email ?? '').toLowerCase().includes(lq)
        || (c.contactNo ?? '').includes(q)
        || c.type.toLowerCase().includes(lq);
      if (!match) return false;
    }
    if (statusFilter && String(c.isActive) !== statusFilter) return false;
    if (typeFilter && c.type !== typeFilter) return false;
    if (dateRange?.from && !isWithinInterval(parseISO(c.createdAt), { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to ?? dateRange.from) })) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Clients" count={clients.length} action={
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
            <IconDownload size={13} /> Export
          </button>
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
            <IconPlus size={13} /> Add Client
          </button>
        </div>
      } />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search clients…" style={inp}
            onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={sel}>
          <option value="">All Types</option><option value="b2b">B2B</option><option value="b2c">B2C</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="">All Status</option><option value="true">Active</option><option value="false">Inactive</option>
        </select>
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Created date" />
        {(q || statusFilter || typeFilter || dateRange) && (
          <button onClick={() => { setQ(''); setStatusFilter(''); setTypeFilter(''); setDateRange(undefined); }}
            style={{ fontSize: 11.5, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#aaa')}>
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
                {['ID', 'Name', 'Company', 'Contact', 'Email', 'Type', 'Plates', 'Vehicles', 'Devices', 'Status', 'Added', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${c.isActive ? '#22c55e' : '#e5e7eb'}` }}>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>{c.displayId}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 500, fontSize: 13 }}>{c.name}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 12 }}>{c.companyName ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 12 }}>{c.contactNo ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 12 }}>{c.email ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{typeTag(c.type)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>
                    {(() => {
                      const plates = plateMap.get(c.id) ?? [];
                      if (!plates.length) return <span style={{ color: '#ccc' }}>—</span>;
                      return <span>{plates[0]}{plates.length > 1 ? <span style={{ color: 'var(--muted)', fontSize: 11 }}> +{plates.length - 1} more</span> : null}</span>;
                    })()}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text)' }}>{c.vehicleCount}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text)' }}>{c.deviceCount}</td>
                  <td style={{ padding: '10px 14px', color: c.isActive ? '#16a34a' : 'var(--muted)', fontSize: 12 }}>{c.isActive ? 'Active' : 'Inactive'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>{fmtDate(c.createdAt)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button onClick={() => navigate(`/clients/${c.id}`)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEye size={14} /></button>
                      <button onClick={() => openEdit(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEdit size={14} /></button>
                      <button onClick={() => setDeleting(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconTrash size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={12} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No clients found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} title={editing ? 'Edit Client' : 'Add Client'} onClose={closeModal}>
        <form onSubmit={handleSubmit}>
          {/* Type selector */}
          <FormField label="Client Type">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['b2b', 'b2c'] as const).map(t => (
                <button key={t} type="button" onClick={() => set('type', t)}
                  style={{ flex: 1, padding: '8px 0', border: `1.5px solid ${form.type === t ? (t === 'b2b' ? '#3b82f6' : '#a855f7') : 'var(--input-border)'}`, borderRadius: 8, background: form.type === t ? (t === 'b2b' ? 'rgba(59,130,246,0.08)' : 'rgba(168,85,247,0.08)') : 'var(--input-bg)', color: form.type === t ? (t === 'b2b' ? '#3b82f6' : '#a855f7') : 'var(--muted)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5 }}>
                  {t === 'b2b' ? 'B2B — Corporate' : 'B2C — Individual'}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Full Name *">
            <input required value={form.name} onChange={e => set('name', e.target.value)}
              placeholder={form.type === 'b2b' ? 'Contact person name' : 'Client full name'}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
          </FormField>

          {form.type === 'b2b' && (
            <FormField label="Company Name">
              <input value={form.companyName} onChange={e => set('companyName', e.target.value)}
                placeholder="e.g. Acme Logistics"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
            </FormField>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Email">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="client@example.com" style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
            </FormField>
            <FormField label="Contact No">
              <input
                value={form.contactNo}
                onChange={e => { setPhoneError(''); handlePhone(e.target.value, set); }}
                onBlur={() => { if (form.contactNo && form.contactNo.length !== 12) setPhoneError('12 digits required (92XXXXXXXXXX)'); }}
                placeholder="923001234567"
                maxLength={12}
                style={{ ...inputStyle, borderColor: phoneError ? '#dc2626' : undefined }}
                onFocus={e => { setPhoneError(''); e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
              />
              {phoneError && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{phoneError}</div>}
            </FormField>
          </div>

          <FormField label={editing ? 'New Password (leave blank to keep)' : 'Set Password'}>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
                placeholder="••••••••"
                style={{ ...inputStyle, paddingRight: 36, width: '100%', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
              <button type="button" onClick={() => setShowPw(p => !p)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 0, display: 'flex', alignItems: 'center' }}>
                {showPw ? <IconEyeOff size={15} /> : <IconEye size={15} />}
              </button>
            </div>
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

          <FormActions onClose={closeModal} loading={saving} submitLabel={editing ? 'Update' : 'Add Client'} />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete Client"
        message={`Delete client "${deleting?.name}"? This cannot be undone.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />
    </div>
  );
}

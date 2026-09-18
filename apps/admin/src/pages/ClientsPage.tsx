import { useEffect, useState, FormEvent } from 'react';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconEye, IconBuilding, IconUsers, IconCar, IconCpu, IconMapPin, IconPhone, IconMail, IconLock, IconX } from '@tabler/icons-react';
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
  id: string; displayId: number; name: string;
  pocName: string | null; contactNo: string | null; email: string | null;
  cityId: string | null; isActive: boolean; createdAt: string;
  customerCount: number; vehicleCount: number; deviceCount: number;
}

const sel: React.CSSProperties = { height: 34, padding: '0 10px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12.5, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer' };
const inp: React.CSSProperties = { height: 34, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 6, fontSize: 12.5, color: 'var(--input-color)', outline: 'none', background: 'var(--input-bg)', width: 200 };
const empty = { name: '', pocName: '', contactNo: '', email: '', password: '', cityId: '', isActive: true };

function StatBadge({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: `${color}14`, fontSize: 12, fontWeight: 500, color }}>
      <Icon size={12} />
      {value}
      <span style={{ fontWeight: 400, color, opacity: 0.7 }}>{label}</span>
    </div>
  );
}

function ClientDrawer({ client, cities, onClose }: { client: Client; cities: { id: string; name: string }[]; onClose: () => void }) {
  const cityName = cities.find(c => c.id === client.cityId)?.name ?? '—';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex' }}>
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ width: 420, background: 'var(--bg)', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconBuilding size={18} color="#dc2626" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{client.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Client #{client.displayId}</div>
              </div>
            </div>
            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: client.isActive ? 'rgba(34,197,94,0.1)' : 'var(--bg3)', color: client.isActive ? '#16a34a' : 'var(--muted)' }}>
              {client.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
            <IconX size={18} />
          </button>
        </div>

        {/* Stats */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { icon: IconUsers, label: 'Customers', value: client.customerCount, color: '#8b5cf6' },
            { icon: IconCar, label: 'Vehicles', value: client.vehicleCount, color: '#16a34a' },
            { icon: IconCpu, label: 'Devices', value: client.deviceCount, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: `${s.color}0d`, border: `1px solid ${s.color}22` }}>
              <s.icon size={18} color={s.color} style={{ marginBottom: 4 }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: s.color, opacity: 0.7, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Info */}
        <div style={{ padding: '16px 24px', flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Contact Information</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: IconUsers, label: 'POC Name', value: client.pocName ?? '—' },
              { icon: IconPhone, label: 'Contact No', value: client.contactNo ?? '—' },
              { icon: IconMail, label: 'Email', value: client.email ?? '—' },
              { icon: IconMapPin, label: 'City', value: cityName },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)' }}>
                <row.icon size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 1 }}>{row.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Portal login status */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, margin: '20px 0 12px' }}>Portal Access</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: client.email ? 'rgba(34,197,94,0.06)' : 'var(--bg2)', border: `1px solid ${client.email ? 'rgba(34,197,94,0.2)' : 'var(--border)'}` }}>
            <IconLock size={16} color={client.email ? '#16a34a' : 'var(--muted)'} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: client.email ? '#16a34a' : 'var(--muted)' }}>
                {client.email ? 'Portal login enabled' : 'No portal access'}
              </div>
              {client.email && <div style={{ fontSize: 11, color: '#16a34a', opacity: 0.7 }}>{client.email}</div>}
            </div>
          </div>

          <div style={{ marginTop: 20, padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)', fontSize: 12, color: 'var(--muted)' }}>
            Added on {fmtDate(client.createdAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(empty);
  const { cities, selectedCityId } = useCityFilter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState(false);
  const [viewing, setViewing] = useState<Client | null>(null);

  const load = () => api.get<Client[]>('/organizations').then(r => setClients(r.data)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ name: c.name, pocName: c.pocName ?? '', contactNo: c.contactNo ?? '', email: c.email ?? '', password: '', cityId: c.cityId ?? '', isActive: c.isActive });
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); };
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        pocName: form.pocName || null,
        contactNo: form.contactNo || null,
        email: form.email || null,
        cityId: form.cityId || null,
        isActive: form.isActive,
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
    if (q && !c.name.toLowerCase().includes(q.toLowerCase()) && !(c.pocName ?? '').toLowerCase().includes(q.toLowerCase())) return false;
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
                {['ID', 'Company', 'POC', 'Contact', 'Customers', 'Vehicles', 'Devices', 'Status', 'Added', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${c.isActive ? '#22c55e' : '#e5e7eb'}` }}>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>{c.displayId}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 500, fontSize: 13 }}>{c.name}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 12 }}>{c.pocName ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 12 }}>{c.contactNo ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <StatBadge icon={IconUsers} label="" value={c.customerCount} color="#8b5cf6" />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <StatBadge icon={IconCar} label="" value={c.vehicleCount} color="#16a34a" />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <StatBadge icon={IconCpu} label="" value={c.deviceCount} color="#f59e0b" />
                  </td>
                  <td style={{ padding: '10px 14px', color: c.isActive ? '#16a34a' : 'var(--muted)', fontSize: 12 }}>{c.isActive ? 'Active' : 'Inactive'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>{fmtDate(c.createdAt)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button onClick={() => setViewing(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#3b82f6')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEye size={14} /></button>
                      <button onClick={() => openEdit(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEdit size={14} /></button>
                      <button onClick={() => setDeleting(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconTrash size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={10} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No clients found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal open={modal} title={editing ? 'Edit Client' : 'Add Client'} onClose={closeModal}>
        <form onSubmit={handleSubmit}>
          <FormField label="Company Name *">
            <input required value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Acme Logistics" style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="POC Name">
              <input value={form.pocName} onChange={e => set('pocName', e.target.value)}
                placeholder="e.g. Ali Khan" style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
            </FormField>
            <FormField label="Contact No">
              <input value={form.contactNo} onChange={e => set('contactNo', e.target.value)}
                placeholder="03001234567" style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Email (Portal Login)">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="client@example.com" style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
            </FormField>
            <FormField label={editing ? 'New Password (optional)' : 'Set Password'}>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                placeholder={editing ? 'Leave empty to keep' : 'Portal login password'}
                required={!editing && !!form.email}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
            </FormField>
          </div>
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
          <FormActions onClose={closeModal} loading={saving} submitLabel={editing ? 'Update' : 'Create Client'} />
        </form>
      </Modal>

      {/* View Drawer */}
      {viewing && <ClientDrawer client={viewing} cities={cities} onClose={() => setViewing(null)} />}

      <ConfirmDialog open={!!deleting} title="Delete Client"
        message={`Delete client "${deleting?.name}"? This cannot be undone.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />
    </div>
  );
}

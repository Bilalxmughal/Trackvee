import { useEffect, useState, useRef, FormEvent } from 'react';
import { IconPlus, IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import type { DateRange } from '../components/DateRangePicker';
import { format } from 'date-fns';
import api from '../api/client';
import { fmtDate } from '../utils/date';
import SkeletonTable from '../components/SkeletonTable';
import { useCityFilter } from '../contexts/CityFilterContext';
import PageHeader from '../components/PageHeader';
import DateRangePicker from '../components/DateRangePicker';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';

interface Device { id: string; displayId: number; imei: string; name: string | null; simNumber: string | null; cityId: string | null; status: string; inventoryStatus: 'in_stock' | 'assigned' | 'maintenance' | 'retired'; lastSeenAt: string | null; vehicleId: string | null; vehicleDisplayId: number | null; licensePlate: string | null; make: string | null; model: string | null; organizationId: string | null; clientName: string | null; createdAt: string; }
interface Organization { id: string; name: string; }
interface AdminUser { id: string; firstName: string | null; lastName: string | null; email: string; role: string; organizationId: string | null; }
interface InventorySummary { total: number; assigned: number; inStock: number; }

const sel: React.CSSProperties = { height: 30, padding: '0 8px', border: '1px solid var(--input-border)', borderRadius: 3, fontSize: 12, color: 'var(--input-color)', background: 'var(--input-bg)', outline: 'none', cursor: 'pointer' };
const inp: React.CSSProperties = { height: 30, padding: '0 10px 0 30px', border: '1px solid var(--input-border)', borderRadius: 3, fontSize: 12, color: 'var(--input-color)', outline: 'none', background: 'var(--input-bg)', width: 180 };
const empty = { imei: '', name: '', simNumber: '', cityId: '', inventoryStatus: 'in_stock' as Device['inventoryStatus'] };

function SearchableFilter({ options, value, onChange, placeholder }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void; placeholder: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const selected = options.find(option => option.id === value)?.label ?? '';
  const matches = options.filter(option => option.label.toLowerCase().includes(q.toLowerCase()));
  return <div ref={ref} style={{ position: 'relative', minWidth: 190 }}>
    <input value={open ? q : selected} placeholder={placeholder} style={{ ...sel, width: '100%', cursor: 'text' }}
      onFocus={() => { setQ(''); setOpen(true); }} onChange={event => { setQ(event.target.value); setOpen(true); }} />
    {open && <div style={{ position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 450, maxHeight: 230, overflowY: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,.14)' }}>
      <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => { onChange(''); setOpen(false); setQ(''); }} style={{ width: '100%', padding: '8px 10px', textAlign: 'left', border: 0, borderBottom: '1px solid var(--border2)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>All</button>
      {matches.map(option => <button key={option.id} type="button" onMouseDown={event => event.preventDefault()} onClick={() => { onChange(option.id); setOpen(false); setQ(''); }} style={{ width: '100%', padding: '8px 10px', textAlign: 'left', border: 0, borderBottom: '1px solid var(--border2)', background: option.id === value ? 'rgba(220,38,38,.06)' : 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>{option.label}</button>)}
      {!matches.length && <div style={{ padding: 10, color: 'var(--muted)', fontSize: 12 }}>No results</div>}
    </div>}
  </div>;
}

function lastSeenLabel(ts: string | null) {
  if (!ts) return '—';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({ total: 0, assigned: 0, inStock: 0 });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [clientUsers, setClientUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Device | null>(null);
  const [deletingId, setDeletingId] = useState(false);
  const { cities, selectedCityId } = useCityFilter();

  const load = () => {
    const query = new URLSearchParams();
    if (selectedCityId) query.set('cityId', selectedCityId);
    if (organizationFilter) query.set('organizationId', organizationFilter);
    if (ownerFilter) query.set('ownerId', ownerFilter);
    if (statusFilter) query.set('status', statusFilter);
    if (q.trim()) query.set('search', q.trim());
    if (dateRange?.from) query.set('from', format(dateRange.from, 'yyyy-MM-dd'));
    if (dateRange?.to) query.set('to', format(dateRange.to, 'yyyy-MM-dd'));
    api.get<Device[]>(`/devices/inventory?${query.toString()}`)
      .then(response => setDevices(response.data))
      .catch(() => {}).finally(() => setLoading(false));
    api.get<InventorySummary>(`/devices/inventory/summary${selectedCityId ? `?cityId=${selectedCityId}` : ''}`)
      .then(response => setSummary(response.data)).catch(() => {});
  };
  useEffect(() => {
    Promise.all([api.get<Organization[]>('/organizations'), api.get<AdminUser[]>('/users/org-users')])
      .then(([o, u]) => { setOrganizations(o.data); setClientUsers(u.data.filter(item => item.role.startsWith('client_'))); })
      .catch(() => {});
  }, []);
  useEffect(() => { load(); }, [selectedCityId, organizationFilter, ownerFilter, statusFilter, q, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (d: Device) => {
    setEditing(d);
    setForm({ imei: d.imei, name: d.name ?? '', simNumber: d.simNumber ?? '', cityId: d.cityId ?? '', inventoryStatus: d.inventoryStatus });
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); };
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, cityId: form.cityId || null };
      if (editing) await api.patch(`/devices/${editing.id}`, payload);
      else await api.post('/devices', payload);
      await load(); closeModal();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(true);
    try {
      await api.delete(`/devices/${deleting.id}`);
      setDevices(d => d.filter(x => x.id !== deleting.id));
      setDeleting(null);
    } catch (error: any) { window.alert(error?.response?.data?.message ?? 'Unable to delete this device'); } finally { setDeletingId(false); }
  };

  // The API applies this filter through the selected user's effective vehicle
  // permissions. Filtering here by vehicle creator would hide valid results.
  const filtered = devices;
  const userOptions = clientUsers.filter(user => !organizationFilter || user.organizationId === organizationFilter).map(user => ({ id: user.id, label: `${[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email} · ${user.email}` }));
  const summaryCards: { label: string; value: number; color: string }[] = [
    { label: 'Total Devices', value: summary.total, color: '#111' },
    { label: 'Assigned Devices', value: summary.assigned, color: '#16a34a' },
    { label: 'In Stock', value: summary.inStock, color: '#dc2626' },
  ];

  return (
    <div>
      <PageHeader title="Devices" count={devices.length} action={
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          <IconPlus size={13} /> Add Device
        </button>
      } />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(150px, 1fr))', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--border)' }}>
        {summaryCards.map(card => <div key={card.label} style={{ padding: '14px 16px', background: 'var(--bg2)', borderLeft: `3px solid ${card.color}` }}><div style={{ fontSize: 11, color: 'var(--muted)' }}>{card.label}</div><div style={{ marginTop: 5, fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div></div>)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search IMEI, device, or plate…" style={inp}
            onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="">All Assignment States</option><option value="assigned">Assigned</option><option value="in_stock">In Stock</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option>
        </select>
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Added date" />
        <SearchableFilter options={organizations.map(org => ({ id: org.id, label: org.name }))} value={organizationFilter} onChange={id => { setOrganizationFilter(id); setOwnerFilter(''); }} placeholder="Search client…" />
        <SearchableFilter options={userOptions} value={ownerFilter} onChange={setOwnerFilter} placeholder="Search client user…" />
        {(q || statusFilter || dateRange || organizationFilter || ownerFilter) && <button onClick={() => { setQ(''); setStatusFilter(''); setDateRange(undefined); setOrganizationFilter(''); setOwnerFilter(''); }} style={{ fontSize: 11, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer' }}>Clear filters</button>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{filtered.length} results</span>
      </div>

      {loading ? <SkeletonTable cols={8} /> : (
        <div className="tbl-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['ID', 'IMEI', 'Device', 'SIM', 'Assignment', 'Vehicle', 'Client', 'Connection', 'Last Seen', 'Added', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const online = d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 5 * 60 * 1000;
              const borderColor = online ? '#16a34a' : d.vehicleId ? '#dc2626' : '#9ca3af';
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${borderColor}` }}>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{d.displayId}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11 }}>{d.imei}</td>
                  <td style={{ padding: '10px 14px' }}>{d.name ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{d.simNumber ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: d.inventoryStatus === 'assigned' ? '#16a34a' : d.inventoryStatus === 'retired' ? '#6b7280' : d.inventoryStatus === 'maintenance' ? '#f59e0b' : '#9ca3af' }}>{d.inventoryStatus.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{d.vehicleId ? `${d.vehicleDisplayId ?? ''} ${d.licensePlate ?? ''}`.trim() : '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{d.clientName ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: online ? '#16a34a' : '#9ca3af' }}>
                    {online ? 'Online' : 'Offline'}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{lastSeenLabel(d.lastSeenAt)}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{fmtDate(d.createdAt)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(d)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEdit size={14} /></button>
                      <button onClick={() => setDeleting(d)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 4, borderRadius: 3 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconTrash size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={11} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No devices found</td></tr>}
          </tbody>
        </table>
        </div>
      )}

      <Modal open={modal} title={editing ? 'Edit Device' : 'Add Device'} onClose={closeModal} width='min(1200px, 97vw)' height='min(800px, 96vh)'>
        <form onSubmit={handleSubmit}>
          <FormField label="IMEI *">
            <input required value={form.imei} onChange={e => set('imei', e.target.value)} placeholder="15-digit IMEI number" maxLength={20}
              style={inputStyle} readOnly={!!editing}
              onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FormField label="Device Name">
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Tracker-01" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
            </FormField>
            <FormField label="SIM Number">
              <input value={form.simNumber} onChange={e => set('simNumber', e.target.value)} placeholder="03001234567" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
            </FormField>
          </div>
          <FormField label="City">
              <select value={form.cityId} onChange={e => set('cityId', e.target.value)} style={selectStyle}>
                <option value="">— Select City —</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
          </FormField>
          {editing && !editing.vehicleId && <FormField label="Inventory Status">
            <select value={form.inventoryStatus} onChange={event => set('inventoryStatus', event.target.value)} style={selectStyle}>
              <option value="in_stock">In Stock</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option>
            </select>
          </FormField>}
          <FormActions onClose={closeModal} loading={saving} submitLabel={editing ? 'Update' : 'Register Device'} />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete Device"
        message={`Delete device "${deleting?.imei}"? Devices with telemetry or assignment history are retained and must be marked Retired.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />
    </div>
  );
}

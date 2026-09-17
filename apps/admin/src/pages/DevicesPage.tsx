import { useEffect, useState, FormEvent } from 'react';
import { IconPlus, IconSearch, IconEdit, IconTrash } from '@tabler/icons-react';
import type { DateRange } from 'react-day-picker';
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import DateRangePicker from '../components/DateRangePicker';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';

interface Device { id: string; displayId: number; imei: string; name: string | null; simNumber: string | null; isActive: boolean; lastSeenAt: string | null; vehicle?: { licensePlate: string | null; displayId: number; id: string } | null; createdAt: string; }
interface Vehicle { id: string; displayId: number; licensePlate: string | null; make: string | null; model: string | null; }

const sel: React.CSSProperties = { height: 30, padding: '0 8px', border: '1px solid #e8e8e8', borderRadius: 3, fontSize: 12, color: '#555', background: '#fff', outline: 'none', cursor: 'pointer' };
const inp: React.CSSProperties = { height: 30, padding: '0 10px 0 30px', border: '1px solid #e8e8e8', borderRadius: 3, fontSize: 12, color: '#111', outline: 'none', background: '#fff', width: 180 };
const empty = { imei: '', name: '', simNumber: '', isActive: true, vehicleId: '' };

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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Device | null>(null);
  const [deletingId, setDeletingId] = useState(false);

  const load = () => {
    Promise.all([api.get<Device[]>('/devices'), api.get<Vehicle[]>('/vehicles')])
      .then(([d, v]) => { setDevices(d.data); setVehicles(v.data); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (d: Device) => {
    setEditing(d);
    setForm({ imei: d.imei, name: d.name ?? '', simNumber: d.simNumber ?? '', isActive: d.isActive, vehicleId: d.vehicle?.id ?? '' });
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditing(null); };
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, vehicleId: form.vehicleId || null };
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
    } catch { } finally { setDeletingId(false); }
  };

  const filtered = devices.filter(d => {
    if (q && !d.imei.includes(q) && !(d.name ?? '').toLowerCase().includes(q.toLowerCase())) return false;
    if (statusFilter && String(d.isActive) !== statusFilter) return false;
    if (dateRange?.from && !isWithinInterval(parseISO(d.createdAt), { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to ?? dateRange.from) })) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Devices" count={devices.length} action={
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          <IconPlus size={13} /> Add Device
        </button>
      } />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderBottom: '1px solid #f5f5f5', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <IconSearch size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#ccc' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="IMEI or name…" style={inp}
            onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')} onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sel}>
          <option value="">All Status</option><option value="true">Active</option><option value="false">Inactive</option>
        </select>
        <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="Added date" />
        {(q || statusFilter || dateRange) && <button onClick={() => { setQ(''); setStatusFilter(''); setDateRange(undefined); }} style={{ fontSize: 11, color: '#aaa', border: 'none', background: 'none', cursor: 'pointer' }}>Clear all</button>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{filtered.length} results</span>
      </div>

      {loading ? <Spinner /> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              {['ID', 'IMEI', 'Name', 'SIM', 'Vehicle', 'Last Seen', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#aaa', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const online = d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 5 * 60 * 1000;
              const borderColor = !d.isActive ? '#e5e7eb' : online ? '#22c55e' : '#dc2626';
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid #f8f8f8', borderLeft: `3px solid ${borderColor}` }}>
                  <td style={{ padding: '10px 16px', color: '#aaa' }}>#{d.displayId}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11 }}>{d.imei}</td>
                  <td style={{ padding: '10px 16px' }}>{d.name ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: '#555' }}>{d.simNumber ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: '#555' }}>
                    {d.vehicle ? `#${d.vehicle.displayId} ${d.vehicle.licensePlate ?? ''}`.trim() : <span style={{ color: '#ddd' }}>Unassigned</span>}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#aaa' }}>{lastSeenLabel(d.lastSeenAt)}</td>
                  <td style={{ padding: '10px 16px', color: !d.isActive ? '#aaa' : online ? '#16a34a' : '#dc2626' }}>
                    {!d.isActive ? 'Inactive' : online ? 'Online' : 'Offline'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
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
            {!filtered.length && <tr><td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No devices found</td></tr>}
          </tbody>
        </table>
      )}

      <Modal open={modal} title={editing ? 'Edit Device' : 'Add Device'} onClose={closeModal}>
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
          <FormField label="Link to Vehicle">
            <select value={form.vehicleId} onChange={e => set('vehicleId', e.target.value)} style={selectStyle}>
              <option value="">Unassigned</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  #{v.displayId} — {v.licensePlate ?? ''} {v.make ?? ''} {v.model ?? ''}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Status">
            <select value={String(form.isActive)} onChange={e => set('isActive', e.target.value === 'true')} style={selectStyle}>
              <option value="true">Active</option><option value="false">Inactive</option>
            </select>
          </FormField>
          <FormActions onClose={closeModal} loading={saving} submitLabel={editing ? 'Update' : 'Register Device'} />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete Device"
        message={`Delete device "${deleting?.imei}"? This cannot be undone.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />
    </div>
  );
}
